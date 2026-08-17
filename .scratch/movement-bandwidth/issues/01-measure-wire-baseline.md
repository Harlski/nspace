---
Type: research
Status: resolved
Blocked by:
---

# Measure current movement wire baseline

## Question

What is the UTF-8 JSON size of today's movement-related WebSocket messages (`state`, `stateDelta`, `moveOrder`, `moveAbort`), and what is server egress vs per-client ingress for **10 / 20 / 30** players at the current tick/broadcast cadence — idle, all walking (Path Playback cut-stream), and occupied-social (full `state` events)?

## Answer

Path Playback already sends **0 pose bytes per 50 ms tick** and **0 per 120 ms broadcast** while only grid-walk pose is changing. The live cost is `moveOrder` on walk start (~373 B for 8 waypoints, × N recipients) plus **full roster `state`** on presence events (~4.5 / 8.8 / 13.2 KiB payload for N=10/20/30; server egress × N).

Social-hub model (10 full-state events/min + 2 walks/player/min): **0.51 / 2.0 / 4.5 MiB/min** server for N=10/20/30. Legacy pose stream if the kill switch is on: **22 / 86 / 193 MiB/min** when all are walking.

Numbers from `estimate-baseline.mjs`. Synthesis: [../ANALYSIS.md](../ANALYSIS.md).
