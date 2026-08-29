#!/usr/bin/env python3
"""Preview (or apply) a login-streak backfill from event-log session_start days.

Rebuilds each wallet's current consecutive UTC-day streak from WebSocket
connects (the same presence rule as room enter). Hub/Pay verify days that never
opened a socket are kept by unioning the ledger's lastLoginDayUtc.

Dry-run by default. Does not decrease a stored streak (event logs may not
reach back far enough).

Usage (from the compose project directory):
  python3 scripts/login-streak-backfill.py
  python3 scripts/login-streak-backfill.py /path/to/data
  python3 scripts/login-streak-backfill.py --apply

Stop or restart the game process after --apply so in-memory same-day credit
cache does not keep the old streakDays.
"""

import argparse
import datetime
import glob
import json
import os
import shutil
import sys

ONE_DAY = datetime.timedelta(days=1)


def compact(s):
    return "".join(str(s or "").split()).upper()


def utc_day_from_ms(ms):
    return datetime.datetime.fromtimestamp(
        ms / 1000, datetime.timezone.utc
    ).date()


def resolve_data_dir(explicit):
    if explicit:
        return os.path.abspath(explicit)
    env = os.environ.get("NSPACE_DATA_DIR") or os.environ.get("DATA_DIR")
    if env:
        return os.path.abspath(env)
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    for candidate in (
        os.path.join(os.getcwd(), "data"),
        os.path.join(repo, "data"),
        os.path.join(repo, "server", "data"),
    ):
        if os.path.isdir(candidate):
            return candidate
    return os.path.join(os.getcwd(), "data")


def is_wallet(addr):
    return addr.startswith("NQ") and len(addr) >= 36 and not addr.startswith("GUEST:")


def parse_day(s):
    try:
        return datetime.date.fromisoformat(str(s).strip()[:10])
    except ValueError:
        return None


def consecutive_streak(days):
    """days: set of datetime.date. Returns (streakDays, lastDay) or (0, None)."""
    if not days:
        return 0, None
    ordered = sorted(days)
    last = ordered[-1]
    streak = 1
    expected = last - ONE_DAY
    for i in range(len(ordered) - 2, -1, -1):
        d = ordered[i]
        if d == expected:
            streak += 1
            expected = d - ONE_DAY
        elif d < expected:
            break
    return streak, last


def load_ledger(path):
    if not os.path.exists(path):
        return {}
    data = json.load(open(path, encoding="utf-8"))
    raw = data.get("streaks") if isinstance(data, dict) else None
    if not isinstance(raw, dict):
        return {}
    out = {}
    for key, row in raw.items():
        w = compact(key)
        if not is_wallet(w) or not isinstance(row, dict):
            continue
        days = row.get("streakDays")
        last = parse_day(row.get("lastLoginDayUtc"))
        updated = row.get("updatedAt")
        out[w] = {
            "streakDays": int(days) if isinstance(days, (int, float)) and days >= 1 else 0,
            "lastLoginDayUtc": last,
            "updatedAt": int(updated) if isinstance(updated, (int, float)) else None,
            "raw": row,
        }
    return out


def load_usernames(path):
    names = {}
    if not os.path.exists(path):
        return names
    try:
        profiles = json.load(open(path, encoding="utf-8")).get("profiles") or {}
    except (OSError, json.JSONDecodeError) as e:
        print("WARN: could not read %s: %s" % (path, e), file=sys.stderr)
        return names
    for addr, row in profiles.items():
        w = compact(addr)
        name = str((row or {}).get("customUsername") or "").strip()
        if w and name:
            names[w] = name
    return names


def scan_session_days(events_glob, today):
    """wallet -> set of UTC dates with session_start."""
    files = sorted(glob.glob(events_glob))
    by_wallet = {}
    n = len(files)
    for i, fp in enumerate(files, 1):
        hits = 0
        try:
            fh = open(fp, encoding="utf-8")
        except OSError as e:
            print("WARN: skip %s: %s" % (fp, e), file=sys.stderr)
            continue
        with fh:
            for line in fh:
                if "session_start" not in line:
                    continue
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                if rec.get("kind") != "session_start":
                    continue
                w = compact(rec.get("address"))
                if not is_wallet(w):
                    continue
                ts = rec.get("ts")
                if not isinstance(ts, (int, float)):
                    continue
                day = utc_day_from_ms(ts)
                if day > today:
                    continue
                bucket = by_wallet.get(w)
                if bucket is None:
                    bucket = set()
                    by_wallet[w] = bucket
                bucket.add(day)
                hits += 1
        print(
            "[%d/%d] %s  session_start_hits=%d  wallets=%d"
            % (i, n, os.path.basename(fp), hits, len(by_wallet)),
            file=sys.stderr,
            flush=True,
        )
    return by_wallet


def classify(current_days, current_last, proposed_days, proposed_last):
    if proposed_days <= 0:
        return "EMPTY"
    if current_days <= 0:
        return "NEW"
    if proposed_days > current_days:
        return "INCREASE"
    if proposed_days < current_days:
        return "SKIP_SHRINK"
    if proposed_last and current_last and proposed_last > current_last:
        return "INCREASE"
    return "UNCHANGED"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data_dir", nargs="?", help="Host data dir (default: ./data)")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write login-streaks.json (creates a .bak first). Default is preview only.",
    )
    parser.add_argument(
        "--changes-only",
        action="store_true",
        help="Print only INCREASE / NEW / SKIP_SHRINK rows.",
    )
    args = parser.parse_args()

    data = resolve_data_dir(args.data_dir)
    today = datetime.datetime.now(datetime.timezone.utc).date()
    streak_path = os.path.join(data, "login-streaks.json")
    profiles_path = os.path.join(data, "player-profiles.json")
    events_glob = os.path.join(data, "events", "events-*.jsonl")

    print("dataDir: %s" % data, file=sys.stderr)
    print("todayUtc: %s" % today.isoformat(), file=sys.stderr)
    print("mode: %s" % ("APPLY" if args.apply else "PREVIEW"), file=sys.stderr)

    ledger = load_ledger(streak_path)
    names = load_usernames(profiles_path)
    event_days = scan_session_days(events_glob, today)

    wallets = set(ledger) | set(event_days)
    rows = []
    for w in wallets:
        cur = ledger.get(w) or {
            "streakDays": 0,
            "lastLoginDayUtc": None,
            "updatedAt": None,
            "raw": None,
        }
        days = set(event_days.get(w) or ())
        if cur["lastLoginDayUtc"] is not None:
            days.add(cur["lastLoginDayUtc"])
        proposed_days, proposed_last = consecutive_streak(days)
        status = classify(
            cur["streakDays"], cur["lastLoginDayUtc"], proposed_days, proposed_last
        )
        # Apply never shrinks: keep ledger values when SKIP_SHRINK.
        apply_days = proposed_days
        apply_last = proposed_last
        if status == "SKIP_SHRINK":
            apply_days = cur["streakDays"]
            apply_last = cur["lastLoginDayUtc"] or proposed_last
        rows.append(
            {
                "wallet": w,
                "username": names.get(w) or "",
                "status": status,
                "currentDays": cur["streakDays"],
                "currentLast": cur["lastLoginDayUtc"].isoformat()
                if cur["lastLoginDayUtc"]
                else "",
                "proposedDays": proposed_days,
                "proposedLast": proposed_last.isoformat() if proposed_last else "",
                "applyDays": apply_days,
                "applyLast": apply_last.isoformat() if apply_last else "",
                "delta": apply_days - cur["streakDays"],
                "raw": cur["raw"],
                "updatedAt": cur["updatedAt"],
            }
        )

    rows.sort(key=lambda r: (-r["delta"], -r["applyDays"], r["wallet"]))

    counts = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    print(file=sys.stderr)
    print(
        "wallets=%d  INCREASE=%d  NEW=%d  SKIP_SHRINK=%d  UNCHANGED=%d  EMPTY=%d"
        % (
            len(rows),
            counts.get("INCREASE", 0),
            counts.get("NEW", 0),
            counts.get("SKIP_SHRINK", 0),
            counts.get("UNCHANGED", 0),
            counts.get("EMPTY", 0),
        ),
        file=sys.stderr,
    )
    would_write = [r for r in rows if r["status"] in ("INCREASE", "NEW")]
    print("wouldWrite=%d" % len(would_write), file=sys.stderr)
    print(file=sys.stderr)

    print(
        "status\tcurrentDays\tproposedDays\tapplyDays\tdelta\tcurrentLast\tproposedLast\tusername\twallet"
    )
    for r in rows:
        if args.changes_only and r["status"] not in ("INCREASE", "NEW", "SKIP_SHRINK"):
            continue
        print(
            "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s"
            % (
                r["status"],
                r["currentDays"],
                r["proposedDays"],
                r["applyDays"],
                r["delta"],
                r["currentLast"],
                r["proposedLast"],
                r["username"],
                r["wallet"],
            )
        )

    if not args.apply:
        print(
            "\nPreview only. Re-run with --apply to write %s (backup first)."
            % streak_path,
            file=sys.stderr,
        )
        return 0

    if not would_write:
        print("Nothing to write.", file=sys.stderr)
        return 0

    backup = "%s.bak-%s" % (
        streak_path,
        datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
    )
    if os.path.exists(streak_path):
        shutil.copy2(streak_path, backup)
        print("backup: %s" % backup, file=sys.stderr)

    now_ms = int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)
    streaks = {}
    if os.path.exists(streak_path):
        try:
            existing = json.load(open(streak_path, encoding="utf-8"))
            if isinstance(existing, dict) and isinstance(existing.get("streaks"), dict):
                streaks = dict(existing["streaks"])
        except (OSError, json.JSONDecodeError):
            streaks = {}

    # Re-key compact on write for rows we touch; leave other keys as-is.
    by_compact = {}
    drop_keys = []
    for key, row in list(streaks.items()):
        w = compact(key)
        by_compact[w] = (key, row)

    for r in would_write:
        w = r["wallet"]
        last = r["applyLast"]
        days = r["applyDays"]
        if not last or days < 1:
            continue
        new_row = {
            "lastLoginDayUtc": last,
            "streakDays": days,
            "updatedAt": now_ms,
        }
        old = by_compact.get(w)
        if old:
            old_key, _ = old
            if old_key != w:
                drop_keys.append(old_key)
            streaks[w] = new_row
        else:
            streaks[w] = new_row

    for k in drop_keys:
        streaks.pop(k, None)

    tmp = streak_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"streaks": streaks}, fh, separators=(",", ":"))
        fh.write("\n")
    os.rename(tmp, streak_path)
    print("wrote %s (%d wallets updated)" % (streak_path, len(would_write)), file=sys.stderr)
    print(
        "Restart the game server so the in-memory login-streak cache reloads.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
