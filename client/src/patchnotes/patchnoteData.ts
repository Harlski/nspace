import { collectPatchnotesFromGlob, type PatchnoteRelease } from "./collectPatchnotes.js";

const modules = import.meta.glob<string>("../../../patchnote/versions/*/public/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

export const PATCHNOTE_RELEASES: PatchnoteRelease[] =
  collectPatchnotesFromGlob(modules);
