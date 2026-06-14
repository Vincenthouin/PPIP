// electron-builder afterPack hook.
//
// Runs a proper deep ad-hoc codesign over the freshly-packed .app bundle.
// Without this, electron-builder leaves the bundle only "linker-signed" at
// the binary level (the .app wrapper has no real signature), which on
// macOS Sequoia surfaces as the misleading "PPIP is damaged" Gatekeeper
// error when downloaded with the quarantine attribute set.
//
// Ad-hoc signing (identity "-") doesn't need an Apple Developer cert and
// downgrades the error to the standard right-click -> Open workaround.

const { execFileSync } = require("node:child_process");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  console.log(`[after-pack] deep ad-hoc signing ${appPath}`);
  execFileSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath],
    { stdio: "inherit" },
  );

  // Verify (best-effort — surface failures but don't abort the build, so we
  // can still inspect the result).
  try {
    execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
      stdio: "inherit",
    });
    console.log("[after-pack] signature verified");
  } catch (e) {
    console.warn("[after-pack] codesign --verify failed (continuing)");
  }
};
