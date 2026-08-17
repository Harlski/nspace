---
Type: grilling
Status: done
Blocked by:
---

# Poor-connection / no-teleport contract

## Question

What contract keeps Path Playback visually correct under lag, clock skew, and packet loss — without sending full pose every frame — while still allowing intentional snaps (room change, `moveAbort`, Freeze, teleporter, join, jump > 6, pitch free-move)?

## Answer

Agent-locked contract: [../research/03-poor-connection-contract.md](../research/03-poor-connection-contract.md).
