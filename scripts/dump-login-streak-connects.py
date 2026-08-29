#!/usr/bin/env python3
"""Dump login-streak ledger row + event-log session_start history for a wallet.

Streak credit is written only on POST /api/auth/verify. session_start is every
WebSocket connect (including a still-valid cached JWT). Run from the compose
project directory (./data) or pass a data dir.

Usage:
  python3 scripts/dump-login-streak-connects.py
  python3 scripts/dump-login-streak-connects.py NQ84LJ01B1410RT31M0SA1GDPUQPKYGCVSFC
  python3 scripts/dump-login-streak-connects.py someUsername /path/to/data
"""

import datetime
import glob
import json
import os
import sys

DEFAULT_WALLET = "NQ84LJ01B1410RT31M0SA1GDPUQPKYGCVSFC"


def compact(s):
    return "".join(str(s or "").split()).upper()


def utc_iso(ms):
    return datetime.datetime.fromtimestamp(
        ms / 1000, datetime.timezone.utc
    ).strftime("%Y-%m-%dT%H:%M:%SZ")


def utc_day(ms):
    return datetime.datetime.fromtimestamp(
        ms / 1000, datetime.timezone.utc
    ).strftime("%Y-%m-%d")


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


def resolve_wallet(query, profiles_path):
    wallet = compact(query) if compact(query).startswith("NQ") else None
    username = None
    if not os.path.exists(profiles_path):
        return wallet, username
    try:
        profiles = json.load(open(profiles_path, encoding="utf-8")).get("profiles") or {}
    except (OSError, json.JSONDecodeError) as e:
        print(f"WARN: could not read {profiles_path}: {e}", file=sys.stderr)
        return wallet, username
    if wallet:
        username = (profiles.get(wallet) or {}).get("customUsername")
        return wallet, username
    want = query.strip().lower()
    for addr, row in profiles.items():
        name = str((row or {}).get("customUsername") or "").strip()
        if name.lower() == want:
            return compact(addr), name
    return None, None


def main():
    print("dump-login-streak-connects starting", flush=True)
    args = [a for a in sys.argv[1:] if a]
    query = DEFAULT_WALLET
    data_dir = None
    if args and not os.path.isdir(args[0]):
        query = args.pop(0)
    if args:
        data_dir = args[0]

    data = resolve_data_dir(data_dir)
    streak_path = os.path.join(data, "login-streaks.json")
    profiles_path = os.path.join(data, "player-profiles.json")
    events_glob = os.path.join(data, "events", "events-*.jsonl")

    wallet, username = resolve_wallet(query, profiles_path)
    if not wallet:
        print(f"ERROR: could not resolve wallet from {query!r}", file=sys.stderr)
        print(f"data dir: {data}", file=sys.stderr)
        return 1

    streaks: dict = {}
    if os.path.exists(streak_path):
        try:
            streaks = json.load(open(streak_path, encoding="utf-8")).get("streaks") or {}
        except (OSError, json.JSONDecodeError) as e:
            print(f"ERROR: could not read {streak_path}: {e}", file=sys.stderr)
            return 1
    else:
        print(f"WARN: missing {streak_path}", file=sys.stderr)
    row = streaks.get(wallet)

    print("=== login-streak ledger ===")
    print("query:", query)
    print("wallet:", wallet)
    print("username:", username)
    print("dataDir:", data)
    print("row:", json.dumps(row, indent=2) if row else "NOT IN LEDGER")
    print()

    starts = []
    files = sorted(glob.glob(events_glob))
    for fp in files:
        try:
            fh = open(fp, encoding="utf-8")
        except OSError as e:
            print(f"WARN: skip {fp}: {e}", file=sys.stderr)
            continue
        with fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if rec.get("kind") != "session_start":
                    continue
                if compact(rec.get("address")) != wallet:
                    continue
                ts = rec.get("ts")
                if not isinstance(ts, (int, float)):
                    continue
                payload = rec.get("payload") or {}
                starts.append(
                    {
                        "utc": utc_iso(ts),
                        "utcDay": utc_day(ts),
                        "roomId": rec.get("roomId"),
                        "sessionId": rec.get("sessionId"),
                        "nimiqPay": bool(payload.get("nimiqPay")),
                        "logFile": os.path.basename(fp),
                    }
                )

    starts.sort(key=lambda r: r["utc"])
    days = []
    for r in starts:
        if not days or days[-1]["utcDay"] != r["utcDay"]:
            days.append({"utcDay": r["utcDay"], "connects": 0})
        days[-1]["connects"] += 1

    print("=== session_start (WS connect; not Hub/Pay verify) ===")
    print("eventFilesScanned:", len(files))
    print("connects:", len(starts))
    print("distinctUtcDays:", len(days))
    print("utcDays:", [d["utcDay"] for d in days])
    print()
    print("utcDay\tconnects")
    for d in days:
        print(f"{d['utcDay']}\t{d['connects']}")
    print()
    print("utc\tutcDay\troomId\tnimiqPay\tsessionId")
    for r in starts:
        print(
            f"{r['utc']}\t{r['utcDay']}\t{r['roomId']}\t{r['nimiqPay']}\t{r['sessionId']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
