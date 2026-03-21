#!/usr/bin/env node

/**
 * rename-project-name.mjs
 *
 * Uso:
 *   node scripts/rename-project-name.mjs --from "Nome Antigo" --to "Rayzen PDV"
 *   node scripts/rename-project-name.mjs --from "OldName" --from "OLD_NAME" --to "Rayzen PDV"
 *
 * Seguranca:
 * - Exclui node_modules, dist, build, .git e diretorios gerados.
 * - So reescreve arquivos com extensoes de texto conhecidas.
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function getArgValues(flag) {
  const values = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) {
      values.push(args[index + 1]);
    }
  }

  return values;
}

const fromList = getArgValues("--from");
const to = getArgValues("--to")[0] || "Rayzen PDV";

if (fromList.length === 0) {
  console.error(
    'Uso: node scripts/rename-project-name.mjs --from "Nome Antigo" [--from "Outro"] [--to "Rayzen PDV"]',
  );
  process.exit(1);
}

const ROOT = process.cwd();
const EXCLUDE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "out",
  ".git",
  ".next",
  ".turbo",
]);

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".env",
  ".ini",
  ".csproj",
]);

function shouldSkipDir(dirName) {
  return EXCLUDE_DIRS.has(dirName);
}

function isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function replaceAll(content) {
  let output = content;

  for (const from of fromList) {
    output = output.split(from).join(to);
  }

  return output;
}

let changedFiles = 0;
let totalReplacements = 0;

function walk(currentDir) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) {
        continue;
      }

      walk(fullPath);
      continue;
    }

    if (!entry.isFile() || !isTextFile(fullPath)) {
      continue;
    }

    const before = fs.readFileSync(fullPath, "utf8");
    const after = replaceAll(before);

    if (after === before) {
      continue;
    }

    fs.writeFileSync(fullPath, after, "utf8");
    changedFiles += 1;

    for (const from of fromList) {
      totalReplacements += Math.max(0, before.split(from).length - 1);
    }

    console.log(`Atualizado: ${path.relative(ROOT, fullPath)}`);
  }
}

walk(ROOT);

console.log(
  `\nConcluido. Arquivos alterados: ${changedFiles}. Substituicoes (aprox.): ${totalReplacements}.`,
);
