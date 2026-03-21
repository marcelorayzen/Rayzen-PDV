#!/usr/bin/env node

import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tscCli = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");
const dbTestScript = path.join(projectRoot, "packages", "db", "test", "run-db-foundation-tests.mjs");
const electronTestScript = path.join(projectRoot, "electron", "test", "run-electron-main-tests.mjs");
const pdvTestScript = path.join(projectRoot, "apps", "pdv", "test", "run-pdv-shell-tests.mjs");

runCommand(process.execPath, [tscCli, "-p", "packages/db/tsconfig.json"]);
runCommand(process.execPath, [dbTestScript]);
runCommand(process.execPath, [tscCli, "-p", "packages/ui/tsconfig.json"]);
runCommand(process.execPath, [tscCli, "-p", "electron/tsconfig.json"]);
runCommand(process.execPath, [electronTestScript]);
runCommand(process.execPath, [tscCli, "-p", "apps/pdv/tsconfig.json"]);
runCommand(process.execPath, [pdvTestScript]);

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
