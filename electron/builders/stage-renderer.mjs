#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const rendererSourceRoot = path.join(projectRoot, "apps", "pdv");
const rendererDistRoot = path.join(rendererSourceRoot, "dist");
const stageRoot = path.join(projectRoot, "electron", "builders", "renderer");

export function stageRendererAssets() {
  const requiredFiles = [
    {
      kind: "HTML",
      sourcePath: path.join(rendererSourceRoot, "index.html"),
      destinationPath: path.join(stageRoot, "index.html")
    },
    {
      kind: "CSS",
      sourcePath: path.join(rendererSourceRoot, "shell.css"),
      destinationPath: path.join(stageRoot, "shell.css")
    },
    {
      kind: "RENDERER_DIST_DIR",
      sourcePath: rendererDistRoot,
      destinationPath: path.join(stageRoot, "dist")
    }
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file.sourcePath)) {
      throw new Error(
        `Missing renderer asset for staging (${file.kind}): ${file.sourcePath}. Run "pnpm build" before packaging.`
      );
    }
  }

  fs.rmSync(stageRoot, {
    recursive: true,
    force: true
  });
  fs.mkdirSync(stageRoot, {
    recursive: true
  });

  for (const file of requiredFiles) {
    fs.cpSync(file.sourcePath, file.destinationPath, {
      recursive: file.kind === "RENDERER_DIST_DIR"
    });
  }

  const manifest = {
    stagedAt: new Date().toISOString(),
    rendererSourceRoot: path.relative(projectRoot, rendererSourceRoot).replace(/\\/g, "/"),
    stageRoot: path.relative(projectRoot, stageRoot).replace(/\\/g, "/"),
    stagedFiles: collectRelativeFiles(stageRoot, stageRoot)
  };

  fs.writeFileSync(
    path.join(stageRoot, "stage-manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  return manifest;
}

if (isDirectExecution()) {
  const manifest = stageRendererAssets();

  console.log(
    `[electron] renderer staged at ${manifest.stageRoot} with ${manifest.stagedFiles.length} files.`
  );
}

function collectRelativeFiles(rootPath, currentPath) {
  const results = [];

  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    const absolutePath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectRelativeFiles(rootPath, absolutePath));
      continue;
    }

    results.push(path.relative(rootPath, absolutePath).replace(/\\/g, "/"));
  }

  return results.sort();
}

function isDirectExecution() {
  return process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}
