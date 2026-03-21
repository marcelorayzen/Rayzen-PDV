#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const filePath = path.resolve(
  process.cwd(),
  ".agents/skills/pdv-ui-builder/examples/shortcuts.json",
);

const data = JSON.parse(readFileSync(filePath, "utf8"));
const requiredKeys = ["F2", "F4", "F6", "F8", "ESC", "ENTER"];

function fail(message) {
  console.error(`[pdv-ui-builder] FAIL: ${message}`);
  process.exit(1);
}

for (const key of requiredKeys) {
  if (!data[key]) {
    fail(`Atalho obrigatorio ausente no fixture: ${key}`);
  }
}

console.log("[pdv-ui-builder] OK: atalhos minimos presentes.");
