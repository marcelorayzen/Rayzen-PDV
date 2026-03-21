import { describe, test } from "@jest/globals";

import {
  runBundledWindowScenario,
  runLogScenario,
  runPathScenario,
  runWindowScenario
} from "../run-electron-main-tests.mjs";

describe("@rayzen/electron unit", () => {
  test("resolves ProgramData paths", () => {
    runPathScenario();
  });

  test("redacts sensitive data from local logs", () => {
    runLogScenario();
  });

  test("creates the desktop window in workspace mode", () => {
    runWindowScenario();
  });

  test("creates the desktop window in bundled mode", () => {
    runBundledWindowScenario();
  });
});
