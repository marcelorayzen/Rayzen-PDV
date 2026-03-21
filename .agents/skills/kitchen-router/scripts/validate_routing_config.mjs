#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const configPath = path.resolve(
  process.cwd(),
  ".agents/skills/kitchen-router/examples/routing_config.json",
);

const config = JSON.parse(readFileSync(configPath, "utf8"));

function fail(message) {
  console.error(`[kitchen-router] FAIL: ${message}`);
  process.exit(1);
}

if (!config.setores?.length) {
  fail("Config sem setores.");
}

for (const setor of config.setores) {
  if (!setor.id || !setor.impressoras?.length) {
    fail(`Setor invalido: ${JSON.stringify(setor)}`);
  }
}

console.log("[kitchen-router] OK: config basica valida.");
