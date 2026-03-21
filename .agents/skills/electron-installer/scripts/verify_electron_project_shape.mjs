#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";

function exists(relativePath) {
  return existsSync(path.resolve(process.cwd(), relativePath));
}

function fail(message) {
  console.error(`[electron-installer] FAIL: ${message}`);
  process.exit(1);
}

if (!exists("electron")) {
  console.log(
    "[electron-installer] WARN: diretorio electron/ nao encontrado. Ajuste o script.",
  );
  process.exit(0);
}

const candidates = [
  "electron/forge.config.js",
  "electron/forge.config.ts",
  "electron-builder.yml",
  "electron/package.json",
];

if (!candidates.some((candidate) => exists(candidate))) {
  fail("Nao encontrei config tipica de empacotamento. Verifique a estrutura do projeto.");
}

console.log("[electron-installer] OK: estrutura minima detectada.");
