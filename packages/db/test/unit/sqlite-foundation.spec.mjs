import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "@jest/globals";

import { getSqliteSidecarPaths, loadMigrations } from "../../dist/index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(currentDir, "../../migrations");

describe("@rayzen/db unit", () => {
  test("returns sqlite sidecar paths deterministically", () => {
    expect(getSqliteSidecarPaths("C:\\ProgramData\\RayzenPDV\\data\\rayzen-pdv.sqlite")).toEqual([
      "C:\\ProgramData\\RayzenPDV\\data\\rayzen-pdv.sqlite",
      "C:\\ProgramData\\RayzenPDV\\data\\rayzen-pdv.sqlite-wal",
      "C:\\ProgramData\\RayzenPDV\\data\\rayzen-pdv.sqlite-shm"
    ]);
  });

  test("loads the current migration set", () => {
    const migrations = loadMigrations(migrationsDir);

    expect(migrations).toHaveLength(8);
    expect(migrations.at(-1)?.version).toBe("0008");
    expect(migrations.at(-1)?.name).toBe("print_routing_foundation");
  });
});
