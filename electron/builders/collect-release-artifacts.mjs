#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const electronRoot = path.join(projectRoot, "electron");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(electronRoot, "package.json"), "utf8")
);
const productSlug = slugify(packageJson.productName ?? packageJson.name ?? "rayzen-pdv");
const version = packageJson.version;
const makeRoot = path.join(electronRoot, "out", "make");
const releaseRoot = path.join(electronRoot, "out", "releases", `v${version}`, "windows");

if (!fs.existsSync(makeRoot)) {
  throw new Error(
    `Electron Forge output not found at ${makeRoot}. Run "pnpm make:win" before collecting release artifacts.`
  );
}

const sourceArtifacts = collectFiles(makeRoot).filter((filePath) => {
  const relativePath = path.relative(makeRoot, filePath).replace(/\\/g, "/");
  return !relativePath.startsWith("releases/");
});

if (sourceArtifacts.length === 0) {
  throw new Error(`No Electron Forge artifacts found under ${makeRoot}.`);
}

fs.rmSync(releaseRoot, {
  recursive: true,
  force: true
});
fs.mkdirSync(releaseRoot, {
  recursive: true
});

const artifacts = sourceArtifacts.map((sourcePath) => {
  const relativeSourcePath = path.relative(makeRoot, sourcePath).replace(/\\/g, "/");
  const extension = path.extname(sourcePath).toLowerCase();
  const stagedFileName = `${productSlug}-v${version}-${slugify(relativeSourcePath)}${extension}`;
  const stagedPath = path.join(releaseRoot, stagedFileName);

  fs.copyFileSync(sourcePath, stagedPath);

  const fileBuffer = fs.readFileSync(stagedPath);

  return {
    kind: inferArtifactKind(sourcePath),
    sourceRelativePath: relativeSourcePath,
    outputFileName: stagedFileName,
    relativePath: path.relative(releaseRoot, stagedPath).replace(/\\/g, "/"),
    sizeBytes: fileBuffer.length,
    sha256: crypto.createHash("sha256").update(fileBuffer).digest("hex")
  };
});

const manifest = {
  productName: packageJson.productName,
  version,
  generatedAt: new Date().toISOString(),
  sourceOutputDir: path.relative(electronRoot, makeRoot).replace(/\\/g, "/"),
  releaseRoot: path.relative(electronRoot, releaseRoot).replace(/\\/g, "/"),
  rolloutMode: "manual",
  autoUpdate: false,
  artifacts
};

const manifestPath = path.join(releaseRoot, "manual-rollout-manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

console.log(
  `[electron] manual rollout artifacts collected at ${manifest.releaseRoot} (${artifacts.length} files).`
);

function collectFiles(rootPath) {
  const results = [];

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    const absolutePath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      results.push(...collectFiles(absolutePath));
      continue;
    }

    results.push(absolutePath);
  }

  return results.sort();
}

function inferArtifactKind(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const baseName = path.basename(filePath).toUpperCase();

  if (extension === ".exe") {
    return "WINDOWS_INSTALLER";
  }

  if (extension === ".zip") {
    return "WINDOWS_ZIP";
  }

  if (extension === ".nupkg") {
    return "SQUIRREL_PACKAGE";
  }

  if (baseName === "RELEASES") {
    return "SQUIRREL_RELEASES";
  }

  return "SUPPORTING_FILE";
}

function slugify(value) {
  return value
    .replace(/\.[^./\\]+$/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
