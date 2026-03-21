#!/usr/bin/env node

import {
  runInstallationScenario
} from "../electron/test/run-electron-main-tests.mjs";

runInstallationScenario();

console.log("[qa/install-smoke] 1 runtime check passed.");
