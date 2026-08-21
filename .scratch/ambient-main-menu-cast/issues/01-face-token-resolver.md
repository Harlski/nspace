# 01 — Face Token resolver + cache

**What to build:** Given a wallet address, produce a Face Token (opaque string, not an address) that `@nimiq/identicons` renders as the exact same face as that wallet. Persist tokens so the same wallet reuses the same token without re-searching every time.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Face Token for a wallet yields the same normalized identicon SVG as the wallet address
- [x] Face Token is not a Nimiq address and does not contain the wallet string
- [x] Second lookup for the same wallet returns the cached token without failing
- [x] Rendering path for tokens skips wallet address chunk formatting
