import { describe, test } from "@jest/globals";

import {
  runBaselineScenario,
  runCashSessionRepositoryScenario,
  runComandaRepositoryScenario,
  runFiscalTrailScenario,
  runPrintSpoolRoutingScenario,
  runRepositoriesScenario,
  runRollbackScenario
} from "../run-db-foundation-tests.mjs";

describe("@rayzen/db integration", () => {
  test("bootstraps schema and WAL baseline", () => {
    runBaselineScenario();
  });

  test("persists audit, spool and fiscal queue repositories", () => {
    runRepositoriesScenario();
  });

  test("persists comanda aggregates", () => {
    runComandaRepositoryScenario();
  });

  test("routes print spool with retry and second copy", () => {
    runPrintSpoolRoutingScenario();
  });

  test("persists cash session aggregates", () => {
    runCashSessionRepositoryScenario();
  });

  test("tracks fiscal trail transitions", () => {
    runFiscalTrailScenario();
  });

  test("supports rollback to schema_migrations baseline", () => {
    runRollbackScenario();
  });
});
