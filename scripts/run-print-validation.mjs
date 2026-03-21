#!/usr/bin/env node

import { runPrintSpoolRoutingScenario } from "../packages/db/test/run-db-foundation-tests.mjs";
import {
  runIpcScenario,
  runPrintServiceScenario
} from "../electron/test/run-electron-main-tests.mjs";

runPrintSpoolRoutingScenario();
runPrintServiceScenario();
await runIpcScenario();

console.log("[qa/printing] 3 runtime checks passed.");
