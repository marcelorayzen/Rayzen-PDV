const fs = require("node:fs");
const path = require("node:path");
const { MakerSquirrel } = require("@electron-forge/maker-squirrel");
const { MakerZIP } = require("@electron-forge/maker-zip");

const rendererStageRoot = path.resolve(__dirname, "renderer");
const rendererEntryPoint = path.join(rendererStageRoot, "index.html");
const hasStagedRenderer = fs.existsSync(rendererEntryPoint);

if (!hasStagedRenderer) {
  console.warn(
    '[electron-forge] renderer assets not staged. Run "pnpm build" and "pnpm --filter @rayzen/electron stage:renderer" before packaging.'
  );
}

/** @type {import("@electron-forge/shared-types").ForgeConfig} */
module.exports = {
  outDir: path.resolve(__dirname, "..", "out"),
  packagerConfig: {
    asar: true,
    derefSymlinks: true,
    executableName: "RayzenPDV",
    appCopyright: "Rayzen PDV",
    extraResource: hasStagedRenderer ? [rendererStageRoot] : [],
    win32metadata: {
      CompanyName: "Rayzen PDV",
      FileDescription: "Rayzen PDV",
      InternalName: "RayzenPDV",
      OriginalFilename: "RayzenPDV.exe",
      ProductName: "Rayzen PDV"
    }
  },
  makers: [
    new MakerSquirrel({
      authors: "Rayzen PDV",
      description: "PDV desktop offline-first para bares e restaurantes.",
      name: "rayzen_pdv",
      noMsi: true
    }),
    new MakerZIP({}, ["win32"])
  ]
};
