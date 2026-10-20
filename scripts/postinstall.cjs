"use strict";

const { execSync } = require("child_process");
const path = require("path");

if (process.env.VERCEL) {
  console.log("postinstall: skip patch-package on Vercel");
  process.exit(0);
}

execSync("npx --yes patch-package@8.0.1", {
  stdio: "inherit",
  env: process.env,
});

/** Workspace package ships `main`/`exports` from `dist/`; Vite and server need it after a fresh install. */
try {
  execSync("npm run build --prefix packages/i18n", {
    stdio: "inherit",
    env: process.env,
    cwd: path.join(__dirname, ".."),
  });
} catch (e) {
  console.warn(
    "postinstall: packages/i18n build failed — run `npm run build:i18n` before `npm run dev`"
  );
}
