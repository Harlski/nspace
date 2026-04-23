"use strict";

if (process.env.VERCEL) {
  console.log("postinstall: skip patch-package on Vercel");
  process.exit(0);
}

require("child_process").execSync("npx --yes patch-package@8.0.1", {
  stdio: "inherit",
  env: process.env,
});
