#!/usr/bin/env node

import { runCashSessionRepositoryScenario } from "../packages/db/test/run-db-foundation-tests.mjs";
import {
  runCashControllerScenario,
  runCashGuardrailScenario,
  runCashLifecycleScenario
} from "../apps/pdv/test/run-pdv-shell-tests.mjs";

runCashSessionRepositoryScenario();
runCashLifecycleScenario();
runCashGuardrailScenario();
await runCashControllerScenario();

console.log("[qa/cash] 4 runtime checks passed.");
