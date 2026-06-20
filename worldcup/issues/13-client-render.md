---
id: "13-client-render"
milestone: M1
depends_on: ["12-server-tick-sync"]
status: todo
acceptance:
  - ws.ts ServerMessage gains ballState + goalScored; welcome carries balls
  - Game.ts renders a ball mesh per ball and interpolates toward server positions
  - Goals are rendered on the field (posts/frames)
  - main.ts applies ballState/welcome balls and clears them on room change
verify:
  - "npm run build"
  - "Manual (M1 checkpoint): walk into the ball in the field; it rolls and bounces smoothly"
---

# 13 — Client ball rendering

Add ball meshes (spheres) that lerp toward the latest server `ballState`, mirroring how
remote avatars are smoothed. Render simple goal frames at each end of the field. Ends
Milestone 1: a kickable ball with no scoring yet.
