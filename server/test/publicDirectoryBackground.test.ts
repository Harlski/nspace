import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("admins can save the public directory background", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nspace-directory-bg-"));
  const namesFile = path.join(tmp, "builtin-room-names.json");
  const prev = process.env.BUILTIN_ROOM_NAMES_FILE;
  process.env.BUILTIN_ROOM_NAMES_FILE = namesFile;

  const {
    getBuiltinRoomBackgroundState,
    patchBuiltinRoomSettings,
    resetBuiltinRoomNamesCacheForTests,
  } = await import("../src/builtinRoomNames.js");
  resetBuiltinRoomNamesCacheForTests();

  const saved = patchBuiltinRoomSettings("directory", {
    backgroundHueDeg: 210,
  });
  assert.equal(saved.ok, true);
  assert.deepEqual(getBuiltinRoomBackgroundState("directory"), {
    hueDeg: 210,
    neutral: null,
  });

  const neutral = patchBuiltinRoomSettings("directory", {
    backgroundNeutral: "gray",
  });
  assert.equal(neutral.ok, true);
  assert.deepEqual(getBuiltinRoomBackgroundState("directory"), {
    hueDeg: null,
    neutral: "gray",
  });

  if (prev === undefined) delete process.env.BUILTIN_ROOM_NAMES_FILE;
  else process.env.BUILTIN_ROOM_NAMES_FILE = prev;
  resetBuiltinRoomNamesCacheForTests();
  fs.rmSync(tmp, { recursive: true, force: true });
});
