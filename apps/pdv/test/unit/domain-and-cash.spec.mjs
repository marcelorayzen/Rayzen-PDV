import { describe, test } from "@jest/globals";

import {
  runCashGuardrailScenario,
  runCashLifecycleScenario,
  runComandaCancellationScenario,
  runComandaGuardrailScenario,
  runComandaLifecycleScenario,
  runShortcutFixtureScenario
} from "../run-pdv-shell-tests.mjs";

describe("@rayzen/pdv unit", () => {
  test("keeps keyboard shortcut fixtures stable", () => {
    runShortcutFixtureScenario();
  });

  test("supports the full comanda lifecycle", () => {
    runComandaLifecycleScenario();
  });

  test("requires cancellation reasons on audited flows", () => {
    runComandaCancellationScenario();
  });

  test("blocks invalid comanda checkout guardrails", () => {
    runComandaGuardrailScenario();
  });

  test("supports the full cash lifecycle", () => {
    runCashLifecycleScenario();
  });

  test("blocks cash closing divergence without justification", () => {
    runCashGuardrailScenario();
  });
});
