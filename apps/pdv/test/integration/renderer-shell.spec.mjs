import { describe, test } from "@jest/globals";

import {
  runAuthenticationScenario,
  runCashControllerScenario,
  runCashUiRenderScenario,
  runComandaUiRenderScenario,
  runControllerScenario
} from "../run-pdv-shell-tests.mjs";

describe("@rayzen/pdv integration", () => {
  test("authenticates local operators by PIN", async () => {
    await runAuthenticationScenario();
  });

  test("executes the operational comanda controller flow", async () => {
    await runControllerScenario();
  });

  test("executes the operational cash controller flow", async () => {
    await runCashControllerScenario();
  });

  test("renders the comanda workspace", () => {
    runComandaUiRenderScenario();
  });

  test("renders the cash workspace", () => {
    runCashUiRenderScenario();
  });
});
