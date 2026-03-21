#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { stageRendererAssets } from "./stage-renderer.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const electronRoot = path.join(projectRoot, "electron");
const appStageRoot = path.join(electronRoot, "builders", "app-package");
const makeOutputRoot = path.join(electronRoot, "out", "make");
const dbPackageRoot = path.join(projectRoot, "packages", "db");
const pdvPackageRoot = path.join(projectRoot, "apps", "pdv");
const uiPackageRoot = path.join(projectRoot, "packages", "ui");
const electronPackageJson = JSON.parse(
  fs.readFileSync(path.join(electronRoot, "package.json"), "utf8")
);
const dbPackageJson = JSON.parse(
  fs.readFileSync(path.join(dbPackageRoot, "package.json"), "utf8")
);
const pdvPackageJson = JSON.parse(
  fs.readFileSync(path.join(pdvPackageRoot, "package.json"), "utf8")
);
const uiPackageJson = JSON.parse(
  fs.readFileSync(path.join(uiPackageRoot, "package.json"), "utf8")
);
const electronRuntimePackageJson = JSON.parse(
  fs.readFileSync(path.join(electronRoot, "node_modules", "electron", "package.json"), "utf8")
);

const rendererManifest = stageRendererAssets();

ensureExists(path.join(electronRoot, "dist"), "electron dist");
ensureExists(path.join(electronRoot, "preload.cjs"), "electron preload.cjs");
ensureExists(path.join(dbPackageRoot, "dist"), "@rayzen/db dist");
ensureExists(path.join(dbPackageRoot, "migrations"), "@rayzen/db migrations");
ensureExists(path.join(pdvPackageRoot, "dist"), "@rayzen/pdv dist");
ensureExists(path.join(uiPackageRoot, "dist"), "@rayzen/ui dist");

safeRemoveDirectory(appStageRoot, true);
safeRemoveDirectory(makeOutputRoot, false);

copyDirectory(path.join(electronRoot, "dist"), path.join(appStageRoot, "dist"));
copyDirectory(path.join(electronRoot, "builders", "renderer"), path.join(appStageRoot, "renderer"));
fs.copyFileSync(path.join(electronRoot, "preload.cjs"), path.join(appStageRoot, "preload.cjs"));
copyDirectory(
  path.join(dbPackageRoot, "dist"),
  path.join(appStageRoot, "node_modules", "@rayzen", "db", "dist")
);
copyDirectory(
  path.join(dbPackageRoot, "migrations"),
  path.join(appStageRoot, "node_modules", "@rayzen", "db", "migrations")
);
copyDirectory(
  path.join(pdvPackageRoot, "dist"),
  path.join(appStageRoot, "node_modules", "@rayzen", "pdv", "dist")
);
copyDirectory(
  path.join(uiPackageRoot, "dist"),
  path.join(appStageRoot, "node_modules", "@rayzen", "ui", "dist")
);
fs.mkdirSync(path.join(appStageRoot, "node_modules", "electron"), {
  recursive: true
});

fs.writeFileSync(
  path.join(appStageRoot, "package.json"),
  JSON.stringify(
    {
      name: "rayzen-pdv",
      version: electronPackageJson.version,
      private: true,
      description: electronPackageJson.description,
      author: electronPackageJson.author,
      productName: electronPackageJson.productName,
      type: "module",
      config: {
        forge: "../../forge.config.cjs"
      },
      main: "dist/runtime.js",
      devDependencies: {
        electron: electronPackageJson.devDependencies.electron
      },
      dependencies: {
        "@rayzen/db": dbPackageJson.version,
        "@rayzen/pdv": pdvPackageJson.version,
        "@rayzen/ui": uiPackageJson.version
      }
    },
    null,
    2
  ),
  "utf8"
);

fs.writeFileSync(
  path.join(appStageRoot, "node_modules", "@rayzen", "db", "package.json"),
  JSON.stringify(
    {
      name: dbPackageJson.name,
      version: dbPackageJson.version,
      private: true,
      type: "module",
      main: "dist/index.js",
      types: "dist/index.d.ts"
    },
    null,
    2
  ),
  "utf8"
);

fs.writeFileSync(
  path.join(appStageRoot, "node_modules", "@rayzen", "pdv", "package.json"),
  JSON.stringify(
    {
      name: pdvPackageJson.name,
      version: pdvPackageJson.version,
      private: true,
      type: "module",
      main: "dist/index.js",
      types: "dist/index.d.ts"
    },
    null,
    2
  ),
  "utf8"
);

fs.writeFileSync(
  path.join(appStageRoot, "node_modules", "@rayzen", "ui", "package.json"),
  JSON.stringify(
    {
      name: uiPackageJson.name,
      version: uiPackageJson.version,
      private: true,
      type: "module",
      main: "dist/index.js",
      types: "dist/index.d.ts"
    },
    null,
    2
  ),
  "utf8"
);

fs.writeFileSync(
  path.join(appStageRoot, "node_modules", "electron", "package.json"),
  JSON.stringify(
    {
      name: electronRuntimePackageJson.name,
      version: electronRuntimePackageJson.version,
      main: electronRuntimePackageJson.main
    },
    null,
    2
  ),
  "utf8"
);

const manifest = {
  stagedAt: new Date().toISOString(),
  stageRoot: path.relative(projectRoot, appStageRoot).replace(/\\/g, "/"),
  rendererStageRoot: rendererManifest.stageRoot,
  packageVersion: electronPackageJson.version,
  includedPaths: [
    "dist",
    "renderer",
    "node_modules/electron/package.json",
    "node_modules/@rayzen/db/dist",
    "node_modules/@rayzen/db/migrations",
    "package.json"
  ]
};

fs.writeFileSync(
  path.join(appStageRoot, "stage-manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8"
);

console.log(`[electron] forge app staged at ${manifest.stageRoot}.`);

function ensureExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Missing ${label} at ${targetPath}. Run "pnpm build" before packaging.`);
  }
}

function copyDirectory(sourcePath, destinationPath) {
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.cpSync(sourcePath, destinationPath, {
    recursive: true
  });
}

function safeRemoveDirectory(targetPath, required) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      fs.rmSync(targetPath, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100
      });
      return;
    } catch (error) {
      if (attempt === 4) {
        if (required) {
          throw error;
        }

        console.warn(`[electron] cleanup skipped for ${targetPath}: ${error instanceof Error ? error.message : "unknown error"}`);
        return;
      }
    }
  }
}
