#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifierPath = path.resolve(
  projectRoot,
  ".agents/skills/electron-installer/scripts/verify_electron_project_shape.mjs"
);

process.chdir(projectRoot);
await import(pathToFileURL(verifierPath));
