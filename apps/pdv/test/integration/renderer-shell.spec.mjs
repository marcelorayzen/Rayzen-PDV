import { describe, test } from "@jest/globals";

import {
  runAuthenticationScenario,
  runCashControllerScenario,
  runCashUiRenderScenario,
  runComandaUiRenderScenario,
  runMesaSelectionScenario,
  runMultipleOpenComandasScenario,
  runMesasUiRenderScenario,
  runSettlementViewsRenderScenario,
  runControllerScenario
} from "../run-pdv-shell-tests.mjs";

describe("@rayzen/pdv integration", () => {
  test("authenticates local operators by PIN", async () => {
    await runAuthenticationScenario();
  });

  test("executes the operational comanda controller flow", async () => {
    await runControllerScenario();
  });

  test("selects the target comanda from the mesas map", async () => {
    await runMesaSelectionScenario();
  });

  test("allows multiple comandas to stay active in the same terminal", async () => {
    await runMultipleOpenComandasScenario();
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

  test("renders the mesas workspace", () => {
    runMesasUiRenderScenario();
  });

  test("renders explicit comanda selection for pre-conta, checkout and caixa", () => {
    runSettlementViewsRenderScenario();
  });
});
