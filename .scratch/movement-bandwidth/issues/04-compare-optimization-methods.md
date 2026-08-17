---
Type: prototype
Status: resolved
Blocked by: 01, 02
---

# Compare optimization methods with numbers

## Question

For the same 10 / 20 / 30 occupancy scenarios, how do these methods compare in estimated bytes (and what correctness risk do they add): presence-only deltas instead of full `state`; omit pose from full `state` for active walkers; slim pose vs presence split; numeric rounding; compact keys; 1 Hz pose heartbeat; player spatial interest; permessage-deflate; protobuf?

## Answer

Top wins: **presence `stateDelta`**, **omit walker pose on those messages**, **client hold-last-playback**. Together they cut N=30 social hub from ~4.5 to ~0.68 MiB/min server and close the rewind window.

Rejected as first slices: re-streaming pose, protobuf, player spatial interest, compact keys, compact path encoding.

Deflate is an ops experiment (JSON full-state compresses extremely well in a one-shot zlib test; `ws` has it off for CPU/memory reasons). Heartbeat only after analytic pose + no-rewind.

Tables: [../ANALYSIS.md](../ANALYSIS.md).
