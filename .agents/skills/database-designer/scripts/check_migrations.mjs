#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve(process.cwd(), "packages/db/migrations");

function fail(message) {
  console.error(`[database-designer] FAIL: ${message}`);
  process.exit(1);
}

if (!existsSync(migrationsDir)) {
  console.log(
    "[database-designer] WARN: packages/db/migrations nao encontrado. Ajuste o caminho no script.",
  );
  process.exit(0);
}

const entries = readdirSync(migrationsDir).map((name) =>
  path.join(migrationsDir, name),
);
const directories = entries.filter((entry) => statSync(entry).isDirectory());

for (const directory of directories) {
  const up = path.join(directory, "up.sql");
  const down = path.join(directory, "down.sql");

  if (!existsSync(up)) {
    fail(`Migration sem up.sql: ${directory}`);
  }

  if (!existsSync(down)) {
    fail(`Migration sem down.sql: ${directory}`);
  }
}

console.log(`[database-designer] OK: ${directories.length} migrations com up/down.`);
