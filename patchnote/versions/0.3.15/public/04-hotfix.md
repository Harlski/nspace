# Public patch notes — hotfix (`0.3.15`)

**Audience:** anyone who needs a short “what broke / what we patched / why now” for this corrective release.  
**Depth:** symptom → fix → urgency; not a substitute for Brief → Developers.

---

## What was wrong

The **debug stats panel** (room, obstacles, position, WebSocket timing) could stay **visible all the time** in development builds, cluttering the HUD for normal play and demos.

## What we changed

- Panel is **hidden by default** in all builds.
- **Your profile → identicon** toggles it on or off.
- **`?debug`** in the URL still opens it immediately for testing.

## Why now

Low-risk UI fix; restores the intended “opt-in debug” behavior without blocking the larger **0.3.14** build-menu release already on `main`.
