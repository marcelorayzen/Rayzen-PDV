import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { IPC_CHANNELS } from "../dist/contracts/ipc.js";
import { exposeRayzenDesktopApi } from "../dist/preload-api.js";
import { OperatorAuthService } from "../dist/main/auth/service.js";
import { CatalogService } from "../dist/main/catalog/service.js";
import { ElectronDatabaseService } from "../dist/main/db-service.js";
import { FiscalService } from "../dist/main/fiscal/service.js";
import { registerMainIpcHandlers } from "../dist/main/ipc-server.js";
import { MainProcessLogStore } from "../dist/main/log-store.js";
import { ensureMainProcessPaths, resolveMainProcessPaths } from "../dist/main/paths.js";
import { PdvRoundtripService } from "../dist/main/pdv/service.js";
import { PrintSpoolService } from "../dist/main/printing/service.js";
import { FirstRunSetupService } from "../dist/main/setup/service.js";
import { OperationalSupportService } from "../dist/main/support/service.js";
import { createConfiguredRayzenMainWindow, resolveRendererAssetPaths } from "../dist/main/window-core.js";

export function runPathScenario() {
  const paths = resolveMainProcessPaths({
    programDataRoot: "C:\\ProgramData"
  });

  assert.equal(paths.appRoot, "C:\\ProgramData\\RayzenPDV");
  assert.equal(paths.dataDir, "C:\\ProgramData\\RayzenPDV\\data");
  assert.equal(paths.configDir, "C:\\ProgramData\\RayzenPDV\\config");
  assert.equal(paths.logsDir, "C:\\ProgramData\\RayzenPDV\\logs");
  assert.equal(paths.fiscalDir, "C:\\ProgramData\\RayzenPDV\\fiscal");
  assert.equal(paths.fiscalEventsDir, "C:\\ProgramData\\RayzenPDV\\fiscal\\events");
  assert.equal(paths.fiscalDanfeDir, "C:\\ProgramData\\RayzenPDV\\fiscal\\danfe");
  assert.equal(paths.fiscalXmlDir, "C:\\ProgramData\\RayzenPDV\\fiscal\\xml");
  assert.equal(paths.fiscalSecretsDir, "C:\\ProgramData\\RayzenPDV\\fiscal\\secrets");
  assert.equal(paths.dbFilePath, "C:\\ProgramData\\RayzenPDV\\data\\rayzen-pdv.sqlite");
  assert.equal(paths.runtimeConfigFilePath, "C:\\ProgramData\\RayzenPDV\\config\\runtime-config.json");
}

export function runLogScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-logs-"));

  try {
    const logger = new MainProcessLogStore({
      logsDir: tempRoot,
      appVersion: "0.1.0",
      environment: "test",
      level: "debug"
    });

    logger.info("electron.test.log", {
      terminalId: "term_1",
      csc: "sensitive-value",
      note: "contato maria.teste@rayzen.dev cpf 123.456.789-09 fone 11987654321"
    });

    const destinationDir = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-export-"));
    const exportResult = logger.exportLogs(destinationDir);
    const logContents = fs.readFileSync(logger.logFilePath, "utf8");

    assert.match(logContents, /electron\.test\.log/);
    assert.match(logContents, /\[REDACTED\]/);
    assert.doesNotMatch(logContents, /maria\.teste@rayzen\.dev/);
    assert.doesNotMatch(logContents, /123\.456\.789-09/);
    assert.doesNotMatch(logContents, /11987654321/);
    assert.ok(fs.existsSync(exportResult.manifestFilePath));
    assert.equal(exportResult.logFiles.length, 1);

    safeRemoveDirectory(destinationDir);
  } finally {
    safeRemoveDirectory(tempRoot);
  }
}

export function runPrintServiceScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-print-"));

  try {
    const paths = resolveMainProcessPaths({
      programDataRoot: tempRoot
    });
    ensureMainProcessPaths(paths);

    const logger = new MainProcessLogStore({
      logsDir: paths.logsDir,
      appVersion: "0.1.0",
      environment: "test",
      level: "debug"
    });
    const database = new ElectronDatabaseService(paths, {
      walMode: "enabled"
    });
    database.start();

    const driver = new FakeThermalPrinterDriver({
      printers: [
        {
          printerId: "IMP_COZINHA_01",
          printerName: "IMP_COZINHA_01",
          isOffline: false,
          isAvailable: true,
          status: "Idle"
        }
      ]
    });
    const printService = new PrintSpoolService(database.client, logger, paths, {
      driver,
      autoStart: false
    });

    try {
      const enqueueResult = printService.enqueueProductionTickets({
        sourceEntity: "COMANDA",
        sourceEntityId: "cmd_101",
        comandaNumero: "101",
        mesaId: "M12",
        batchId: "batch_print_1",
        requestedAt: "2026-03-12T16:00:00.000Z",
        actor: {
          userId: "opr_gc_01",
          terminalId: "term_1",
          role: "GARCOM"
        },
        items: [
          {
            itemId: "item_1",
            productLabel: "Prato executivo",
            quantity: 1,
            setor: "COZINHA",
            note: "sem cebola"
          }
        ]
      });
      const processed = printService.processPendingJobs({
        limit: 5,
        asOf: "2026-03-12T16:00:00.000Z"
      });

      assert.equal(enqueueResult.createdJobs.length, 1);
      assert.equal(processed.doneCount, 1);
      assert.equal(driver.printRequests.length, 1);

      const spoolFilePath = path.join(paths.spoolDir, `${enqueueResult.createdJobs[0].printJobId}.txt`);
      const spoolContents = fs.readFileSync(spoolFilePath, "utf8");

      assert.match(spoolContents, /RAYZEN PDV/);
      assert.match(spoolContents, /SEGUNDA VIA|TICKET DE PRODUCAO/);
      assert.match(spoolContents, /Comanda: 101/);
    } finally {
      printService.stop();
      database.close();
    }
  } finally {
    safeRemoveDirectory(tempRoot);
  }
}

export function runPrintRetryScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-print-retry-"));

  try {
    const paths = resolveMainProcessPaths({
      programDataRoot: tempRoot
    });
    ensureMainProcessPaths(paths);

    const logger = new MainProcessLogStore({
      logsDir: paths.logsDir,
      appVersion: "0.1.0",
      environment: "test",
      level: "debug"
    });
    const database = new ElectronDatabaseService(paths, {
      walMode: "enabled"
    });
    database.start();

    const driver = new FakeThermalPrinterDriver({
      printers: [
        {
          printerId: "IMP_COZINHA_01",
          printerName: "IMP_COZINHA_01",
          isOffline: false,
          isAvailable: true,
          status: "Idle"
        }
      ],
      resultsByPrinter: new Map([
        [
          "IMP_COZINHA_01",
          {
            ok: false,
            code: "DRIVER_PRINT_FAILED",
            message: "Falha no driver termico.",
            retryable: true
          }
        ]
      ])
    });
    const printService = new PrintSpoolService(database.client, logger, paths, {
      driver,
      autoStart: false
    });

    try {
      const queued = printService.enqueueProductionTickets({
        sourceEntity: "COMANDA",
        sourceEntityId: "cmd_retry_1",
        comandaNumero: "777",
        mesaId: "M77",
        batchId: "batch_retry_1",
        requestedAt: "2026-03-12T17:00:00.000Z",
        actor: {
          userId: "opr_gc_01",
          terminalId: "term_1",
          role: "GARCOM"
        },
        items: [
          {
            itemId: "item_retry_1",
            productLabel: "Hamburguer",
            quantity: 1,
            setor: "COZINHA",
            note: null
          }
        ]
      });
      const firstPass = printService.processPendingJobs({
        limit: 1,
        asOf: "2026-03-12T17:01:00.000Z"
      });
      const secondPass = printService.processPendingJobs({
        limit: 1,
        asOf: "2026-03-12T17:03:00.000Z"
      });
      const thirdPass = printService.processPendingJobs({
        limit: 1,
        asOf: "2026-03-12T17:06:00.000Z"
      });
      const failedJob = printService.listJobs({
        limit: 10
      })[0];

      driver.resultsByPrinter.delete("IMP_COZINHA_01");

      const reprocessed = printService.reprocessJob({
        printJobId: queued.createdJobs[0].printJobId,
        requestedAt: "2026-03-12T17:07:00.000Z",
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        },
        reason: "liberado apos ajuste de impressora"
      });
      const finalPass = printService.processPendingJobs({
        limit: 1,
        asOf: "2026-03-12T17:08:00.000Z"
      });

      assert.equal(firstPass.jobs[0].status, "WAITING_PRINTER");
      assert.equal(secondPass.jobs[0].status, "WAITING_PRINTER");
      assert.equal(thirdPass.jobs[0].status, "NEEDS_ATTENTION");
      assert.equal(failedJob.attempts, 3);
      assert.equal(reprocessed.status, "QUEUED");
      assert.equal(finalPass.jobs[0].status, "DONE");
    } finally {
      printService.stop();
      database.close();
    }
  } finally {
    safeRemoveDirectory(tempRoot);
  }
}

export async function runFiscalServiceScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-fiscal-"));

  try {
    const paths = resolveMainProcessPaths({
      programDataRoot: tempRoot
    });
    ensureMainProcessPaths(paths);

    const logger = new MainProcessLogStore({
      logsDir: paths.logsDir,
      appVersion: "0.1.0",
      environment: "test",
      level: "debug"
    });
    const database = new ElectronDatabaseService(paths, {
      walMode: "enabled"
    });
    database.start();

    const fiscal = new FiscalService(database.client, logger, paths, {
      safeStorage: new FakeSafeStorage()
    });

    try {
      const emitter = fiscal.configureEmitter({
        emitterId: "emit_sp_1",
        provider: "NS_TECNOLOGIA",
        environment: "HOMOLOGACAO",
        stateCode: "SP",
        documentModel: "65",
        legalName: "Rayzen Restaurante Teste",
        cnpj: "12345678000199",
        stateRegistration: "123456789000",
        cscId: "CSC-HMG-01",
        certificateSubject: "CN=RAYZEN TESTE",
        certificateValidFrom: "2026-03-01T00:00:00.000Z",
        certificateValidUntil: "2027-03-01T00:00:00.000Z",
        certificateBase64: "UEZYLVRFU1RF",
        certificatePassword: "123456",
        csc: "CSC-SEGREDO-HMG",
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        },
        occurredAt: "2026-03-12T18:00:00.000Z"
      });
      const queued = fiscal.queueNfce({
        fiscalDocId: "nfce_100",
        fiscalQueueId: "fq_nfce_100",
        emitterId: "emit_sp_1",
        terminalId: "pdv-main",
        referenceType: "COMANDA",
        referenceId: "cmd_100",
        serie: "1",
        numero: 100,
        payload: {
          totalAmountCents: 6200
        },
        actor: {
          userId: "opr_cx_01",
          terminalId: "pdv-main",
          role: "CAIXA"
        },
        occurredAt: "2026-03-12T18:05:00.000Z"
      });
      const rejectedDraft = fiscal.queueNfce({
        fiscalDocId: "nfce_101",
        fiscalQueueId: "fq_nfce_101",
        emitterId: "emit_sp_1",
        terminalId: "pdv-main",
        referenceType: "COMANDA",
        referenceId: "cmd_101",
        serie: "1",
        numero: 101,
        payload: {
          totalAmountCents: 4200,
          simulation: "rejected"
        },
        actor: {
          userId: "opr_cx_01",
          terminalId: "pdv-main",
          role: "CAIXA"
        },
        occurredAt: "2026-03-12T18:05:30.000Z"
      });
      const processed = await fiscal.processQueue({
        limit: 5,
        asOf: "2026-03-12T18:06:00.000Z"
      });
      const status = fiscal.getStatusSnapshot();
      const authorizedDocument = status.recentDocuments.find((document) => document.status === "AUTHORIZED");

      assert.equal(emitter.hasSecrets, true);
      assert.equal(queued.status, "DRAFT");
      assert.equal(rejectedDraft.status, "DRAFT");
      assert.equal(processed.authorizedCount, 1);
      assert.equal(processed.rejectedCount, 1);
      assert.equal(status.emitters.length, 1);
      assert.equal(status.recentDocuments.some((document) => document.status === "AUTHORIZED"), true);
      assert.equal(status.recentDocuments.some((document) => document.status === "REJECTED"), true);
      assert.ok(authorizedDocument?.xmlStoragePath);
      assert.ok(fs.existsSync(authorizedDocument.xmlStoragePath));
    } finally {
      database.close();
    }
  } finally {
    safeRemoveDirectory(tempRoot);
  }
}

export async function runFiscalContingencyScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-fiscal-cont-"));

  try {
    const paths = resolveMainProcessPaths({
      programDataRoot: tempRoot
    });
    ensureMainProcessPaths(paths);

    const logger = new MainProcessLogStore({
      logsDir: paths.logsDir,
      appVersion: "0.1.0",
      environment: "test",
      level: "debug"
    });
    const database = new ElectronDatabaseService(paths, {
      walMode: "enabled"
    });
    database.start();

    const printerDriver = new FakeThermalPrinterDriver({
      printers: [
        {
          printerId: "IMP_DANFE_01",
          printerName: "IMP_DANFE_01",
          isOffline: false,
          isAvailable: true,
          status: "Idle"
        }
      ]
    });
    const provider = new FakeFiscalProvider({
      issueResults: [
        {
          kind: "CONTINGENCY_REQUIRED",
          code: "NS_TIMEOUT",
          message: "Sem resposta do provider NS.",
          accessKey: "35965001000000000000000000000000000000000000",
          contingencyStartedAt: "2026-03-12T18:06:00.000Z",
          contingencyJustification: "Timeout no canal de autorizacao.",
          nextRetryAt: "2026-03-12T18:10:00.000Z"
        },
        {
          kind: "AUTHORIZED",
          nsReferenceId: "nsref_nfce_101",
          accessKey: "35965001000000000000000000000000000000000000",
          protocolNumber: "135260000000101",
          authorizedAt: "2026-03-12T18:07:00.000Z",
          xmlContent: "<xml>authorized</xml>"
        }
      ],
      queryResults: [
        {
          kind: "NOT_FOUND",
          message: "Documento ainda nao localizado no provider.",
          nextRetryAt: "2026-03-12T18:10:00.000Z"
        },
        {
          kind: "AUTHORIZED",
          nsReferenceId: "nsref_nfce_101",
          accessKey: "35965001000000000000000000000000000000000000",
          protocolNumber: "135260000000101",
          authorizedAt: "2026-03-12T18:07:00.000Z",
          xmlContent: "<xml>authorized</xml>"
        }
      ]
    });
    const fiscal = new FiscalService(database.client, logger, paths, {
      safeStorage: new FakeSafeStorage(),
      printerDriver,
      provider
    });

    try {
      fiscal.configureEmitter({
        emitterId: "emit_sp_2",
        provider: "NS_TECNOLOGIA",
        environment: "HOMOLOGACAO",
        stateCode: "SP",
        documentModel: "65",
        legalName: "Rayzen Restaurante Teste",
        cnpj: "12345678000199",
        stateRegistration: "123456789000",
        cscId: "CSC-HMG-02",
        certificateBase64: "UEZYLVRFU1RF",
        certificatePassword: "123456",
        csc: "CSC-SEGREDO-HMG",
        settings: {
          danfePrinterName: "IMP_DANFE_01"
        },
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        },
        occurredAt: "2026-03-12T18:00:00.000Z"
      });
      fiscal.queueNfce({
        fiscalDocId: "nfce_101",
        fiscalQueueId: "fq_nfce_101",
        emitterId: "emit_sp_2",
        terminalId: "pdv-main",
        referenceType: "COMANDA",
        referenceId: "cmd_101",
        serie: "1",
        numero: 101,
        payload: {
          totalAmountCents: 9100
        },
        actor: {
          userId: "opr_cx_01",
          terminalId: "pdv-main",
          role: "CAIXA"
        },
        occurredAt: "2026-03-12T18:05:00.000Z"
      });

      const firstPass = await fiscal.processQueue({
        limit: 5,
        asOf: "2026-03-12T18:06:00.000Z"
      });
      const contingencyDoc = fiscal.getStatusSnapshot().recentDocuments[0];

      assert.equal(firstPass.contingencyCount, 1);
      assert.equal(contingencyDoc.status, "CONTINGENCY");
      assert.equal(contingencyDoc.emissionMode, "CONTINGENCY_OFFLINE");
      assert.ok(contingencyDoc.contingencyDanfePath);
      assert.ok(fs.existsSync(contingencyDoc.contingencyDanfePath));
      assert.equal(printerDriver.printRequests.length, 1);

      const secondPass = await fiscal.processQueue({
        limit: 5,
        asOf: "2026-03-12T18:11:00.000Z"
      });
      const queried = await fiscal.queryStatusByAccessKey({
        accessKey: "35965001000000000000000000000000000000000000",
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        },
        asOf: "2026-03-12T18:12:00.000Z"
      });
      const trail = database.client.fiscal.getDocumentTrail("nfce_101");

      assert.equal(secondPass.authorizedCount, 1);
      assert.equal(queried.status, "AUTHORIZED");
      assert.equal(trail.document.xmlStoragePath.endsWith(".xml"), true);
      assert.equal(trail.events.some((event) => event.status === "CONTINGENCY"), true);
      assert.equal(trail.document.lastStatusCheckedAt, "2026-03-12T18:12:00.000Z");
    } finally {
      database.close();
    }
  } finally {
    safeRemoveDirectory(tempRoot);
  }
}

export function runSupportServiceScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-support-"));

  try {
    const paths = resolveMainProcessPaths({
      programDataRoot: tempRoot
    });
    ensureMainProcessPaths(paths);

    const logger = new MainProcessLogStore({
      logsDir: paths.logsDir,
      appVersion: "0.1.0",
      environment: "test",
      level: "debug"
    });
    const database = new ElectronDatabaseService(paths, {
      walMode: "enabled"
    });
    database.start();
    const setup = new FirstRunSetupService(database.client, logger, paths, {
      appVersion: "0.1.0"
    });

    const support = new OperationalSupportService(paths, logger, database, {
      appVersion: "0.1.0",
      environment: "test",
      setup
    });

    try {
      const initialSetup = setup.getStatus();
      const completedSetup = setup.completeFirstRun({
        companyLegalName: "Rayzen Restaurante Matriz",
        companyTradeName: "Rayzen Bar",
        companyDocument: "12.345.678/0001-99",
        printers: {
          cozinha: "IMP_COZINHA_01",
          bar: "IMP_BAR_01",
          caixa: "IMP_CAIXA_01"
        },
        occurredAt: "2026-03-12T20:01:00.000Z"
      });
      database.client.auditEvents.append({
        eventId: "evt_support_seed",
        entity: "SUPPORT_OPERATION",
        entityId: "seed",
        action: "SUPPORT_SEED_CREATED",
        actorTerminalId: "term_1",
        occurredAt: "2026-03-12T20:00:00.000Z",
        payload: {
          note: "seed"
        }
      });

      fs.writeFileSync(path.join(paths.spoolDir, "print-job.txt"), "spool");
      fs.mkdirSync(path.join(paths.fiscalXmlDir, "emit_sp_1"), { recursive: true });
      fs.writeFileSync(path.join(paths.fiscalXmlDir, "emit_sp_1", "doc.xml"), "<xml />");
      fs.mkdirSync(path.join(paths.fiscalDanfeDir, "emit_sp_1"), { recursive: true });
      fs.writeFileSync(path.join(paths.fiscalDanfeDir, "emit_sp_1", "doc.txt"), "danfe");
      fs.writeFileSync(path.join(paths.fiscalEventsDir, "nfce_100.ndjson"), "{}\n");

      const exportRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-backup-export-"));
      const backupResult = support.createBackup({
        destinationDir: exportRoot,
        includeLogs: true,
        requestedAt: "2026-03-12T20:05:00.000Z",
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        }
      });

      database.client.auditEvents.append({
        eventId: "evt_support_after_backup",
        entity: "SUPPORT_OPERATION",
        entityId: "seed",
        action: "SUPPORT_AFTER_BACKUP",
        actorTerminalId: "term_1",
        occurredAt: "2026-03-12T20:06:00.000Z",
        payload: {
          note: "should-disappear-after-restore"
        }
      });
      fs.writeFileSync(path.join(paths.spoolDir, "print-job.txt"), "changed");
      fs.writeFileSync(path.join(paths.fiscalEventsDir, "temp.ndjson"), "{\"temp\":true}\n");
      const listedBackupsBeforeRestore = support.listBackups({
        directory: exportRoot
      });

      const restoreResult = support.restoreBackup({
        backupDirectory: backupResult.backupDirectory,
        requestedAt: "2026-03-12T20:07:00.000Z",
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        }
      });
      const supportAudit = database.client.auditEvents.findByEntity("SUPPORT_OPERATION", backupResult.backupDirectory);

      assert.ok(fs.existsSync(backupResult.manifestFilePath));
      assert.equal(initialSetup.firstRunPending, true);
      assert.equal(completedSetup.firstRunPending, false);
      assert.equal(fs.existsSync(paths.runtimeConfigFilePath), true);
      assert.equal(backupResult.artifacts.some((artifact) => artifact.kind === "DATABASE"), true);
      assert.equal(backupResult.artifacts.some((artifact) => artifact.kind === "CONFIG_EXPORT"), true);
      assert.equal(backupResult.artifacts.some((artifact) => artifact.kind === "FISCAL_XML_DIR"), true);
      assert.equal(backupResult.artifacts.some((artifact) => artifact.kind === "FISCAL_DANFE_DIR"), true);
      assert.equal(backupResult.artifacts.some((artifact) => artifact.kind === "FISCAL_EVENTS_DIR"), true);
      assert.equal(backupResult.artifacts.some((artifact) => artifact.kind === "LOG_EXPORT"), true);
      assert.equal(listedBackupsBeforeRestore.length, 1);
      assert.equal(listedBackupsBeforeRestore[0].restorable, true);
      assert.equal(restoreResult.databaseReady, true);
      assert.equal(restoreResult.integrityCheck, "ok");
      assert.equal(restoreResult.requiresRestart, true);
      assert.equal(fs.readFileSync(path.join(paths.spoolDir, "print-job.txt"), "utf8"), "spool");
      assert.equal(fs.existsSync(path.join(paths.fiscalEventsDir, "nfce_100.ndjson")), true);
      assert.equal(fs.existsSync(path.join(paths.fiscalEventsDir, "temp.ndjson")), false);
      assert.equal(supportAudit.length, 2);
      assert.throws(() => database.client.auditEvents.findById("evt_support_after_backup"));
    } finally {
      database.close();
    }
  } finally {
    safeRemoveDirectory(tempRoot);
  }
}

export function runInstallationScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-install-"));

  try {
    const paths = resolveMainProcessPaths({
      programDataRoot: tempRoot
    });
    ensureMainProcessPaths(paths);

    const logger = new MainProcessLogStore({
      logsDir: paths.logsDir,
      appVersion: "0.1.0",
      environment: "test",
      level: "debug"
    });
    const database = new ElectronDatabaseService(paths, {
      walMode: "enabled"
    });
    database.start();

    const setup = new FirstRunSetupService(database.client, logger, paths, {
      appVersion: "0.1.0"
    });
    const auth = new OperatorAuthService(database.client, logger);
    const print = new PrintSpoolService(database.client, logger, paths, {
      autoStart: false
    });
    const pdv = new PdvRoundtripService(database.client, logger, print);

    try {
      const pendingStatus = setup.getStatus();
      const completedStatus = setup.completeFirstRun({
        companyLegalName: "Rayzen Restaurante Matriz",
        companyTradeName: "Rayzen Bar",
        companyDocument: "12.345.678/0001-99",
        printers: {
          cozinha: "IMP_COZINHA_01",
          bar: "IMP_BAR_01",
          caixa: "IMP_CAIXA_01"
        },
        occurredAt: "2026-03-12T21:00:00.000Z"
      });
      const login = auth.login({
        pin: "1234",
        terminalId: "pdv-main"
      });
      pdv.openCashSession({
        openingFundAmountCents: 15000,
        openingReason: "troco inicial",
        actor: {
          userId: login.session.operatorId,
          terminalId: "pdv-main",
          role: login.session.role
        }
      });
      pdv.openComanda({
        numero: "701",
        mesaId: "M7",
        actor: {
          userId: login.session.operatorId,
          terminalId: "pdv-main",
          role: login.session.role
        }
      });

      database.close();

      const restartedDatabase = new ElectronDatabaseService(paths, {
        walMode: "enabled"
      });
      restartedDatabase.start();
      const restartedSetup = new FirstRunSetupService(restartedDatabase.client, logger, paths, {
        appVersion: "0.1.0"
      });
      const restartedAuth = new OperatorAuthService(restartedDatabase.client, logger);
      const restartedPrint = new PrintSpoolService(restartedDatabase.client, logger, paths, {
        autoStart: false
      });
      const restartedPdv = new PdvRoundtripService(restartedDatabase.client, logger, restartedPrint);

      try {
        const statusAfterRestart = restartedSetup.getStatus();
        const sessionAfterRestart = restartedAuth.login({
          pin: "1234",
          terminalId: "pdv-main"
        });
        const cashAfterRestart = restartedPdv.getCashStatus();
        const operationalAfterRestart = restartedPdv.getOperationalSnapshot();

        assert.equal(pendingStatus.firstRunPending, true);
        assert.equal(completedStatus.firstRunPending, false);
        assert.equal(statusAfterRestart.firstRunPending, false);
        assert.equal(statusAfterRestart.company?.legalName, "Rayzen Restaurante Matriz");
        assert.equal(sessionAfterRestart.ok, true);
        assert.equal(cashAfterRestart.currentSession?.status, "ABERTO");
        assert.equal(operationalAfterRestart.comanda.currentComanda?.numero, "701");
      } finally {
        restartedPrint.stop();
        restartedDatabase.close();
      }
    } finally {
      print.stop();
    }
  } finally {
    safeRemoveDirectory(tempRoot);
  }
}

export async function runIpcScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-ipc-"));

  try {
    const paths = resolveMainProcessPaths({
      programDataRoot: tempRoot
    });
    ensureMainProcessPaths(paths);

    const logger = new MainProcessLogStore({
      logsDir: paths.logsDir,
      appVersion: "0.1.0",
      environment: "test",
      level: "debug"
    });
    const database = new ElectronDatabaseService(paths, {
      walMode: "enabled"
    });
    database.start();

    const printService = new PrintSpoolService(database.client, logger, paths, {
      autoStart: false,
      driver: new FakeThermalPrinterDriver({
        printers: [
          {
            printerId: "IMP_COZINHA_01",
            printerName: "IMP_COZINHA_01",
            isOffline: true,
            isAvailable: false,
            status: "Offline"
          },
          {
            printerId: "IMP_BAR_01",
            printerName: "IMP_BAR_01",
            isOffline: false,
            isAvailable: true,
            status: "Idle"
          }
        ]
      })
    });
    const fiscal = new FiscalService(database.client, logger, paths, {
      safeStorage: new FakeSafeStorage()
    });
    const auth = new OperatorAuthService(database.client, logger);
    const catalog = new CatalogService(database.client);
    const pdv = new PdvRoundtripService(database.client, logger, printService, {
      fiscal
    });
    const setup = new FirstRunSetupService(database.client, logger, paths, {
      appVersion: "0.1.0"
    });
    const support = new OperationalSupportService(paths, logger, database, {
      appVersion: "0.1.0",
      environment: "test",
      setup
    });

    const ipcMain = new FakeIpcMain();
    const handlers = registerMainIpcHandlers(ipcMain, {
      appVersion: "0.1.0",
      environment: "test",
      paths,
      logger,
      database,
      auth,
      catalog,
      pdv,
      fiscal,
      print: printService,
      setup,
      support
    });

    try {
      const bootstrap = await ipcMain.invoke(IPC_CHANNELS.systemGetBootstrap);
      const health = await ipcMain.invoke(IPC_CHANNELS.systemGetHealth);
      const initialSetup = await ipcMain.invoke(IPC_CHANNELS.setupGetStatus);
      const completedSetup = await ipcMain.invoke(IPC_CHANNELS.setupCompleteFirstRun, {
        companyLegalName: "Rayzen Restaurante Matriz",
        companyTradeName: "Rayzen Bar",
        companyDocument: "12.345.678/0001-99",
        printers: {
          cozinha: "IMP_COZINHA_01",
          bar: "IMP_BAR_01",
          caixa: "IMP_CAIXA_01"
        },
        occurredAt: "2026-03-12T16:55:00.000Z"
      });
      const dbStatus = await ipcMain.invoke(IPC_CHANNELS.dbGetStatus);
      const invalidLogin = await ipcMain.invoke(IPC_CHANNELS.authLogin, {
        pin: "0000"
      });
      const validLogin = await ipcMain.invoke(IPC_CHANNELS.authLogin, {
        pin: "1234"
      });
      const activeSession = await ipcMain.invoke(IPC_CHANNELS.authGetSession);
      const catalogProducts = await ipcMain.invoke(IPC_CHANNELS.catalogListProducts);
      const catalogProduct = await ipcMain.invoke(IPC_CHANNELS.catalogGetProduct, {
        productId: "prod_hamburguer"
      });
      await ipcMain.invoke(IPC_CHANNELS.authLogout);
      const sessionAfterLogout = await ipcMain.invoke(IPC_CHANNELS.authGetSession);
      await ipcMain.invoke(IPC_CHANNELS.authLogin, {
        pin: "1234"
      });
      const configuredEmitter = await ipcMain.invoke(IPC_CHANNELS.fiscalConfigureEmitter, {
        emitterId: "emit_sp_1",
        provider: "NS_TECNOLOGIA",
        environment: "HOMOLOGACAO",
        stateCode: "SP",
        documentModel: "65",
        legalName: "Rayzen Restaurante Teste",
        cnpj: "12345678000199",
        stateRegistration: "123456789000",
        cscId: "CSC-HMG-01",
        certificateBase64: "UEZYLVRFU1RF",
        certificatePassword: "123456",
        csc: "CSC-SEGREDO-HMG",
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        },
        occurredAt: "2026-03-12T17:00:00.000Z"
      });
      const openedCash = await ipcMain.invoke(IPC_CHANNELS.cashOpenSession, {
        openingFundAmountCents: 15000,
        openingReason: "troco inicial",
        actor: {
          userId: "opr_cx_01",
          terminalId: "pdv-main",
          role: "CAIXA"
        }
      });
      const cashStatusAfterOpen = await ipcMain.invoke(IPC_CHANNELS.cashGetStatus);
      const openedComanda = await ipcMain.invoke(IPC_CHANNELS.comandaOpen, {
        numero: "501",
        mesaId: "M15",
        actor: {
          userId: "opr_gc_01",
          terminalId: "pdv-main",
          role: "GARCOM"
        }
      });
      const openedSecondComanda = await ipcMain.invoke(IPC_CHANNELS.comandaOpen, {
        numero: "502",
        mesaId: "M15",
        actor: {
          userId: "opr_gc_01",
          terminalId: "pdv-main",
          role: "GARCOM"
        }
      });
      const resumedFirstComanda = await ipcMain.invoke(IPC_CHANNELS.comandaOpen, {
        numero: "501",
        mesaId: "M15",
        actor: {
          userId: "opr_gc_01",
          terminalId: "pdv-main",
          role: "GARCOM"
        }
      });
      const workspaceForSecondComanda = await ipcMain.invoke(IPC_CHANNELS.comandaGetWorkspace, {
        comandaId: openedSecondComanda.currentComanda.comandaId
      });
      const withKitchenItem = await ipcMain.invoke(IPC_CHANNELS.comandaAddItem, {
        comandaId: openedComanda.currentComanda.comandaId,
        produtoId: "prod_k_1",
        productLabel: "Prato executivo",
        setor: "COZINHA",
        quantity: 1,
        unitPriceCents: 3200,
        actor: {
          userId: "opr_gc_01",
          terminalId: "pdv-main",
          role: "GARCOM"
        }
      });
      const withAllItems = await ipcMain.invoke(IPC_CHANNELS.comandaAddItem, {
        comandaId: openedComanda.currentComanda.comandaId,
        produtoId: "prod_b_1",
        productLabel: "Suco de laranja",
        setor: "BAR",
        quantity: 1,
        unitPriceCents: 1500,
        actor: {
          userId: "opr_gc_01",
          terminalId: "pdv-main",
          role: "GARCOM"
        }
      });
      const sentToProduction = await ipcMain.invoke(IPC_CHANNELS.comandaSendToProduction, {
        comandaId: openedComanda.currentComanda.comandaId,
        actor: {
          userId: "opr_gc_01",
          terminalId: "pdv-main",
          role: "GARCOM"
        }
      });
      const startedCheckout = await ipcMain.invoke(IPC_CHANNELS.comandaStartCheckout, {
        comandaId: openedComanda.currentComanda.comandaId,
        actor: {
          userId: "opr_cx_01",
          terminalId: "pdv-main",
          role: "CAIXA"
        }
      });
      const confirmedPayment = await ipcMain.invoke(IPC_CHANNELS.comandaConfirmPayment, {
        comandaId: openedComanda.currentComanda.comandaId,
        paymentMethod: "DINHEIRO",
        amountCents: 4700,
        actor: {
          userId: "opr_cx_01",
          terminalId: "pdv-main",
          role: "CAIXA"
        }
      });
      const checkoutFiscalDocument = database.client.fiscal.findLatestDocumentByReference(
        "COMANDA",
        openedComanda.currentComanda.comandaId
      );
      const checkoutPendingQueue = await ipcMain.invoke(IPC_CHANNELS.fiscalListPending, {
        limit: 10
      });
      const checkoutFiscalStatusBefore = await ipcMain.invoke(IPC_CHANNELS.fiscalGetDocumentStatus, {
        fiscalDocId: checkoutFiscalDocument?.fiscalDocId
      });
      const closureStarted = await ipcMain.invoke(IPC_CHANNELS.cashStartClosure, {
        actor: {
          userId: "opr_cx_01",
          terminalId: "pdv-main",
          role: "CAIXA"
        }
      });
      const closedCash = await ipcMain.invoke(IPC_CHANNELS.cashCloseSession, {
        counts: [
          { method: "DINHEIRO", countedAmountCents: 19700 },
          { method: "PIX", countedAmountCents: 0 },
          { method: "CARTAO_CREDITO", countedAmountCents: 0 },
          { method: "CARTAO_DEBITO", countedAmountCents: 0 },
          { method: "OUTRO", countedAmountCents: 0 }
        ],
        note: "fechamento turno ipc",
        actor: {
          userId: "opr_cx_01",
          terminalId: "pdv-main",
          role: "CAIXA"
        }
      });
      const exportedCashAudit = await ipcMain.invoke(IPC_CHANNELS.cashExportAudit);
      const cashSummary = await ipcMain.invoke(IPC_CHANNELS.cashGetSummary);
      const pdvPrintStatus = await ipcMain.invoke(IPC_CHANNELS.printGetStatus);
      const pdvPrintProcessed = await ipcMain.invoke(IPC_CHANNELS.printProcessQueue, {
        limit: 5,
        asOf: "2026-03-12T16:59:00.000Z"
      });
      const fiscalProcessed = await ipcMain.invoke(IPC_CHANNELS.fiscalReprocess, {
        limit: 5,
        asOf: "2026-03-12T17:02:00.000Z"
      });
      const fiscalStatus = await ipcMain.invoke(IPC_CHANNELS.fiscalGetStatus);
      const checkoutFiscalStatusAfter = await ipcMain.invoke(IPC_CHANNELS.fiscalGetDocumentStatus, {
        fiscalDocId: checkoutFiscalDocument?.fiscalDocId
      });
      const queriedCheckoutFiscal = await ipcMain.invoke(IPC_CHANNELS.fiscalQueryStatusByAccessKey, {
        accessKey: checkoutFiscalStatusAfter.accessKey,
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        },
        asOf: "2026-03-12T17:03:00.000Z"
      });
      const emptyPrintStatus = await ipcMain.invoke(IPC_CHANNELS.printGetStatus);

      const enqueueResult = await ipcMain.invoke(IPC_CHANNELS.printEnqueueProduction, {
        sourceEntity: "COMANDA",
        sourceEntityId: "cmd_102",
        comandaNumero: "102",
        mesaId: "M14",
        batchId: "batch_print_2",
        requestedAt: "2026-03-12T17:00:00.000Z",
        actor: {
          userId: "opr_gc_01",
          terminalId: "term_1",
          role: "GARCOM"
        },
        items: [
          {
            itemId: "item_bar_1",
            productLabel: "Suco de laranja",
            quantity: 1,
            setor: "BAR",
            note: null
          },
          {
            itemId: "item_kitchen_1",
            productLabel: "Prato executivo",
            quantity: 1,
            setor: "COZINHA",
            note: "pouco sal"
          }
        ]
      });
      const processed = await ipcMain.invoke(IPC_CHANNELS.printProcessQueue, {
        limit: 5,
        asOf: "2026-03-12T17:00:00.000Z"
      });
      const listedJobs = await ipcMain.invoke(IPC_CHANNELS.printListJobs, {
        limit: 20
      });
      const printers = await ipcMain.invoke(IPC_CHANNELS.printListPrinters);
      const secondCopy = await ipcMain.invoke(IPC_CHANNELS.printReprintSecondCopy, {
        originalJobId: enqueueResult.createdJobs.find((job) => job.setor === "BAR").printJobId,
        requestedAt: "2026-03-12T17:05:00.000Z",
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        },
        reason: "reimpressao teste"
      });
      const reprocessedJob = await ipcMain.invoke(IPC_CHANNELS.printReprocessJob, {
        printJobId: enqueueResult.createdJobs.find((job) => job.setor === "COZINHA").printJobId,
        requestedAt: "2026-03-12T17:06:30.000Z",
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        },
        reason: "teste de reprocessamento"
      });
      const printStatus = await ipcMain.invoke(IPC_CHANNELS.printGetStatus);

      const exportDestination = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-export-"));
      const exportResult = await ipcMain.invoke(IPC_CHANNELS.systemExportLogs, {
        destinationDir: exportDestination
      });
      fs.writeFileSync(path.join(paths.fiscalEventsDir, "ipc-event.ndjson"), "{}\n");
      const backupDestination = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-backup-"));
      const backupResult = await ipcMain.invoke(IPC_CHANNELS.systemCreateBackup, {
        destinationDir: backupDestination,
        includeLogs: true,
        requestedAt: "2026-03-12T17:06:00.000Z",
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        }
      });
      const listedBackups = await ipcMain.invoke(IPC_CHANNELS.backupList, {
        directory: backupDestination
      });
      fs.writeFileSync(path.join(paths.fiscalEventsDir, "temp.ndjson"), "{\"temp\":true}\n");
      const restoreResult = await ipcMain.invoke(IPC_CHANNELS.backupRestore, {
        backupDirectory: backupResult.backupDirectory,
        requestedAt: "2026-03-12T17:07:00.000Z",
        actor: {
          userId: "opr_gr_01",
          terminalId: "term_1",
          role: "GERENTE"
        }
      });

      assert.equal(bootstrap.offlineFirst, true);
      assert.equal(bootstrap.httpApiEnabled, false);
      assert.equal(health.databaseReady, true);
      assert.equal(initialSetup.firstRunPending, true);
      assert.equal(completedSetup.firstRunPending, false);
      assert.equal(dbStatus.filePath, paths.dbFilePath);
      assert.equal(dbStatus.pendingMigrationVersions.length, 0);
      assert.equal(invalidLogin.ok, false);
      assert.equal(validLogin.ok, true);
      assert.equal(activeSession?.operatorCode, "ADMIN");
      assert.equal(sessionAfterLogout, null);
      assert.equal(catalogProducts.length >= 4, true);
      assert.equal(catalogProduct?.label, "Hamburguer");
      assert.equal(openedCash.currentSession.status, "ABERTO");
      assert.equal(cashStatusAfterOpen.currentSession.status, "ABERTO");
      assert.equal(openedComanda.currentComanda.status, "ABERTA");
      assert.equal(openedSecondComanda.currentComanda.numero, "502");
      assert.equal(openedSecondComanda.activeComandas.length, 2);
      assert.equal(openedSecondComanda.mesaGroups.find((group) => group.mesaId === "M15")?.comandaCount, 2);
      assert.equal(resumedFirstComanda.currentComanda.comandaId, openedComanda.currentComanda.comandaId);
      assert.equal(workspaceForSecondComanda.currentComanda.comandaId, openedSecondComanda.currentComanda.comandaId);
      assert.equal(withKitchenItem.currentComanda.items.length, 1);
      assert.equal(withAllItems.currentComanda.items.length, 2);
      assert.equal(sentToProduction.currentComanda.status, "EM_PRODUCAO");
      assert.equal(startedCheckout.currentComanda.status, "EM_PAGAMENTO");
      assert.equal(confirmedPayment.comanda.currentComanda.status, "ENCERRADA");
      assert.equal(confirmedPayment.cash.currentSession.status, "ABERTO");
      assert.ok(checkoutFiscalDocument);
      assert.equal(checkoutPendingQueue.some((job) => job.referenceId === openedComanda.currentComanda.comandaId), true);
      assert.equal(checkoutFiscalStatusBefore?.status, "DRAFT");
      assert.equal(closureStarted.currentSession.status, "FECHAMENTO");
      assert.equal(closedCash.currentSession.status, "FECHADO");
      assert.ok(exportedCashAudit.auditExport);
      assert.equal(cashSummary?.totals.totalExpectedAmountCents, 19700);
      assert.equal(exportedCashAudit.auditTrail.some((event) => event.action === "CAIXA_FECHADO"), true);
      assert.equal(pdvPrintStatus.pendingJobs.some((job) => job.sourceEntityId === openedComanda.currentComanda.comandaId), true);
      assert.equal(pdvPrintProcessed.doneCount, 1);
      assert.equal(pdvPrintProcessed.waitingPrinterCount, 1);
      assert.equal(database.client.comandas.findById(openedComanda.currentComanda.comandaId)?.comanda.status, "ENCERRADA");
      assert.equal(database.client.cashSessions.findLatestByTerminalId("pdv-main")?.session.status, "FECHADO");
      assert.equal(database.client.auditEvents.findByEntity("COMANDA", openedComanda.currentComanda.comandaId).length > 0, true);
      assert.equal(configuredEmitter.status, "HABILITADO");
      assert.equal(fiscalProcessed.authorizedCount, 1);
      assert.equal(fiscalStatus.emitters.length, 1);
      assert.equal(checkoutFiscalStatusAfter?.status, "AUTHORIZED");
      assert.equal(queriedCheckoutFiscal.status, "AUTHORIZED");
      assert.equal(fiscalStatus.recentDocuments.some((document) => document.referenceId === openedComanda.currentComanda.comandaId), true);
      assert.equal(emptyPrintStatus.pendingJobs.length >= 1, true);
      assert.equal(enqueueResult.createdJobs.length, 2);
      assert.equal(processed.doneCount >= 1, true);
      assert.equal(processed.waitingPrinterCount >= 1, true);
      assert.equal(listedJobs.length >= 2, true);
      assert.equal(printers.length, 2);
      assert.equal(secondCopy.ticketKind, "SEGUNDA_VIA");
      assert.equal(reprocessedJob.status, "QUEUED");
      assert.equal(printStatus.pendingJobs.some((job) => job.ticketKind === "SEGUNDA_VIA"), true);
      assert.ok(fs.existsSync(exportResult.manifestFilePath));
      assert.ok(fs.existsSync(backupResult.manifestFilePath));
      assert.equal(listedBackups.length, 1);
      assert.equal(listedBackups[0].restorable, true);
      assert.equal(backupResult.artifacts.some((artifact) => artifact.kind === "CONFIG_EXPORT"), true);
      assert.equal(restoreResult.requiresRestart, true);
      assert.equal(restoreResult.integrityCheck, "ok");
      assert.equal(fs.existsSync(path.join(paths.fiscalEventsDir, "ipc-event.ndjson")), true);
      assert.equal(fs.existsSync(path.join(paths.fiscalEventsDir, "temp.ndjson")), false);

      safeRemoveDirectory(exportDestination);
      safeRemoveDirectory(backupDestination);
    } finally {
      handlers.dispose();
      printService.stop();
      database.close();
    }
  } finally {
    // SQLite may keep a short-lived OS handle on Windows even after close().
    // Leave the temp folder for the OS cleaner to avoid false negatives in CI.
  }
}

export async function runPreloadScenario() {
  const bridge = new FakeContextBridge();
  const renderer = new FakeIpcRenderer();

  exposeRayzenDesktopApi(bridge, renderer);

  assert.ok(bridge.api);

  const bootstrap = await bridge.api.system.getBootstrap();
  const health = await bridge.api.system.getHealth();
  const setupStatus = await bridge.api.setup.getStatus();
  const completedSetup = await bridge.api.setup.completeFirstRun({
    companyLegalName: "Rayzen Restaurante Matriz",
    companyTradeName: "Rayzen Bar",
    companyDocument: "12.345.678/0001-99",
    printers: {
      cozinha: "IMP_COZINHA_01",
      bar: "IMP_BAR_01",
      caixa: "IMP_CAIXA_01"
    },
    occurredAt: "2026-03-12T17:59:00.000Z"
  });
  const backupResult = await bridge.api.system.createBackup({
    destinationDir: "C:\\Backups",
    includeLogs: true,
    requestedAt: "2026-03-12T18:00:00.000Z",
    actor: {
      userId: "opr_gr_01",
      terminalId: "term_1",
      role: "GERENTE"
    }
  });
  const restoreResult = await bridge.api.system.restoreBackup({
    backupDirectory: "C:\\Backups\\rayzen-pdv-backup-2026-03-12T18-00-00.000Z",
    requestedAt: "2026-03-12T18:05:00.000Z",
    actor: {
      userId: "opr_gr_01",
      terminalId: "term_1",
      role: "GERENTE"
    }
  });
  const listedBackups = await bridge.api.backup.listar({
    directory: "C:\\Backups"
  });
  const backupAliasResult = await bridge.api.backup.criar({
    destinationDir: "C:\\Backups",
    includeLogs: false,
    requestedAt: "2026-03-12T18:00:30.000Z",
    actor: {
      userId: "opr_gr_01",
      terminalId: "term_1",
      role: "GERENTE"
    }
  });
  const restoreAliasResult = await bridge.api.backup.restaurar({
    backupDirectory: "C:\\Backups\\rayzen-pdv-backup-2026-03-12T18-00-00.000Z",
    requestedAt: "2026-03-12T18:05:30.000Z",
    actor: {
      userId: "opr_gr_01",
      terminalId: "term_1",
      role: "GERENTE"
    }
  });
  const dbStatus = await bridge.api.db.getStatus();
  const loginResult = await bridge.api.auth.login({
    pin: "1234"
  });
  const session = await bridge.api.auth.getSession();
  const catalog = await bridge.api.catalog.listProducts();
  const catalogProduct = await bridge.api.catalog.getProduct({
    productId: "prod_hamburguer"
  });
  const cashStatus = await bridge.api.cash.status();
  const cashSummary = await bridge.api.cash.resumo();
  const operational = await bridge.api.pdv.getOperationalSnapshot();
  const fiscalStatus = await bridge.api.fiscal.getStatus();
  const fiscalPending = await bridge.api.fiscal.listPending({
    limit: 10
  });
  const fiscalDocument = await bridge.api.fiscal.getDocumentStatus({
    fiscalDocId: "nfce_900"
  });
  const fiscalReprocess = await bridge.api.fiscal.reprocess({
    limit: 5,
    asOf: "2026-03-12T18:08:30.000Z"
  });
  const queriedFiscal = await bridge.api.fiscal.queryStatusByAccessKey({
    accessKey: "35965001000000000000000000000000000000000000",
    actor: {
      userId: "opr_gr_01",
      terminalId: "term_1",
      role: "GERENTE"
    }
  });
  const printers = await bridge.api.print.listPrinters();
  const printJobs = await bridge.api.print.listJobs({
    limit: 10
  });
  const reprocessed = await bridge.api.print.reprocessJob({
    printJobId: "job_123",
    requestedAt: "2026-03-12T18:09:00.000Z",
    actor: {
      userId: "opr_gr_01",
      terminalId: "term_1",
      role: "GERENTE"
    },
    reason: "teste preload"
  });
  const printStatus = await bridge.api.print.getStatus();

  assert.equal(bridge.apiKey, "rayzenDesktop");
  assert.equal(bootstrap.offlineFirst, true);
  assert.equal(health.ipcMode, "electron-ipc");
  assert.equal(setupStatus.firstRunPending, true);
  assert.equal(completedSetup.firstRunPending, false);
  assert.equal(backupResult.artifacts.length, 3);
  assert.equal(restoreResult.requiresRestart, true);
  assert.equal(restoreResult.integrityCheck, "ok");
  assert.equal(listedBackups.length, 1);
  assert.equal(backupAliasResult.artifacts.some((artifact) => artifact.kind === "CONFIG_EXPORT"), true);
  assert.equal(restoreAliasResult.requiresRestart, true);
  assert.equal(dbStatus.filePath, "C:\\ProgramData\\RayzenPDV\\data\\rayzen-pdv.sqlite");
  assert.equal(loginResult.ok, true);
  assert.equal(session?.operatorCode, "ADMIN");
  assert.equal(catalog.length >= 4, true);
  assert.equal(catalogProduct?.label, "Hamburguer");
  assert.equal(cashStatus.currentSession?.cashSessionId, "cash_601");
  assert.equal(cashSummary?.totals.totalExpectedAmountCents, 19700);
  assert.equal(operational.comanda.currentComanda?.numero, "601");
  assert.equal(operational.comanda.activeComandas.length, 1);
  assert.equal(operational.comanda.mesaGroups.length, 1);
  assert.equal(operational.comanda.mesaGroups[0]?.mesaId, "M20");
  assert.equal(fiscalStatus.emitters[0].provider, "NS_TECNOLOGIA");
  assert.equal(fiscalPending.length, 1);
  assert.equal(fiscalDocument?.fiscalDocId, "nfce_900");
  assert.equal(fiscalReprocess.processedCount, 1);
  assert.equal(queriedFiscal.accessKey, "35965001000000000000000000000000000000000000");
  assert.equal(printers[0].printerName, "IMP_BAR_01");
  assert.equal(printJobs.length >= 1, true);
  assert.equal(reprocessed.status, "QUEUED");
  assert.equal(printStatus.routes.length, 2);
  await bridge.api.auth.logout();
}

export function runWindowScenario() {
  const paths = resolveRendererAssetPaths({
    workspaceRoot: "E:\\Workspace\\Rayzen PDV"
  });

  assert.equal(paths.rendererHtmlPath, "E:\\Workspace\\Rayzen PDV\\apps\\pdv\\index.html");
  assert.equal(paths.preloadScriptPath.endsWith("\\electron\\preload.cjs"), true);

  const createdWindow = createConfiguredRayzenMainWindow(FakeBrowserWindow, {
    workspaceRoot: "E:\\Workspace\\Rayzen PDV"
  });

  assert.equal(createdWindow.window.loadedFiles[0], "E:\\Workspace\\Rayzen PDV\\apps\\pdv\\index.html");
  assert.equal(createdWindow.window.options.webPreferences.contextIsolation, true);
  assert.equal(createdWindow.window.options.webPreferences.sandbox, undefined);
  assert.equal(createdWindow.window.options.webPreferences.nodeIntegration, false);
}

export function runBundledWindowScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-electron-renderer-"));

  try {
    const rendererBundleDir = path.join(tempRoot, "renderer");
    fs.mkdirSync(rendererBundleDir, { recursive: true });
    fs.writeFileSync(path.join(rendererBundleDir, "index.html"), "<html><body>rayzen</body></html>");

    const paths = resolveRendererAssetPaths({
      workspaceRoot: "E:\\Workspace\\Rayzen PDV",
      rendererBundleDir
    });
    const createdWindow = createConfiguredRayzenMainWindow(FakeBrowserWindow, {
      workspaceRoot: "E:\\Workspace\\Rayzen PDV",
      rendererBundleDir
    });

    assert.equal(paths.rendererHtmlPath, path.join(rendererBundleDir, "index.html"));
    assert.equal(createdWindow.window.loadedFiles[0], path.join(rendererBundleDir, "index.html"));
  } finally {
    safeRemoveDirectory(tempRoot);
  }
}

class FakeThermalPrinterDriver {
  printers;
  printRequests = [];
  resultsByPrinter;

  constructor(options) {
    this.printers = options.printers;
    this.resultsByPrinter = options.resultsByPrinter ?? new Map();
  }

  listPrinters() {
    return this.printers.map((printer) => ({ ...printer }));
  }

  printText(request) {
    this.printRequests.push(request);

    if (this.resultsByPrinter.has(request.printerName)) {
      return this.resultsByPrinter.get(request.printerName);
    }

    const printer = this.printers.find((item) => item.printerName === request.printerName);

    if (!printer) {
      return {
        ok: false,
        code: "PRINTER_NOT_FOUND",
        message: "Impressora nao encontrada.",
        retryable: true
      };
    }

    if (printer.isOffline || !printer.isAvailable) {
      return {
        ok: false,
        code: "PRINTER_OFFLINE",
        message: "Impressora offline.",
        retryable: true
      };
    }

    return { ok: true };
  }
}

class FakeIpcMain {
  #handlers = new Map();

  handle(channel, listener) {
    this.#handlers.set(channel, listener);
  }

  removeHandler(channel) {
    this.#handlers.delete(channel);
  }

  async invoke(channel, payload) {
    const handler = this.#handlers.get(channel);

    if (!handler) {
      throw new Error(`Missing handler for ${channel}`);
    }

    return handler({}, payload);
  }
}

class FakeIpcRenderer {
  async invoke(channel, payload) {
    if (channel === IPC_CHANNELS.systemGetBootstrap) {
      return {
        appVersion: "0.1.0-test",
        environment: "test",
        offlineFirst: true,
        httpApiEnabled: false,
        ipcMode: "electron-ipc",
        paths: {
          appRoot: "C:\\ProgramData\\RayzenPDV",
          dataDir: "C:\\ProgramData\\RayzenPDV\\data",
          configDir: "C:\\ProgramData\\RayzenPDV\\config",
          logsDir: "C:\\ProgramData\\RayzenPDV\\logs",
          backupsDir: "C:\\ProgramData\\RayzenPDV\\backups",
          spoolDir: "C:\\ProgramData\\RayzenPDV\\spool",
          fiscalDir: "C:\\ProgramData\\RayzenPDV\\fiscal",
          fiscalEventsDir: "C:\\ProgramData\\RayzenPDV\\fiscal\\events",
          fiscalDanfeDir: "C:\\ProgramData\\RayzenPDV\\fiscal\\danfe",
          fiscalXmlDir: "C:\\ProgramData\\RayzenPDV\\fiscal\\xml",
          fiscalSecretsDir: "C:\\ProgramData\\RayzenPDV\\fiscal\\secrets",
          dbFilePath: "C:\\ProgramData\\RayzenPDV\\data\\rayzen-pdv.sqlite",
          runtimeConfigFilePath: "C:\\ProgramData\\RayzenPDV\\config\\runtime-config.json"
        },
        databaseReady: true,
        logFilePath: "C:\\ProgramData\\RayzenPDV\\logs\\rayzen-pdv.log"
      };
    }

    if (channel === IPC_CHANNELS.systemGetHealth) {
      return {
        ready: true,
        databaseReady: true,
        httpApiEnabled: false,
        ipcMode: "electron-ipc",
        dbFilePath: "C:\\ProgramData\\RayzenPDV\\data\\rayzen-pdv.sqlite",
        logFilePath: "C:\\ProgramData\\RayzenPDV\\logs\\rayzen-pdv.log"
      };
    }

    if (channel === IPC_CHANNELS.systemCreateBackup) {
      return {
        backupDirectory: "C:\\Backups\\rayzen-pdv-backup-2026-03-12T18-00-00.000Z",
        manifestFilePath: "C:\\Backups\\rayzen-pdv-backup-2026-03-12T18-00-00.000Z\\backup-manifest.json",
        artifacts: [
          {
            kind: "DATABASE",
            relativePath: "data\\rayzen-pdv.sqlite"
          },
          {
            kind: "CONFIG_EXPORT",
            relativePath: "config\\runtime-config.json"
          },
          {
            kind: "LOG_EXPORT",
            relativePath: "rayzen-pdv-logs-2026-03-12T18-00-00.000Z"
          }
        ],
        createdAt: "2026-03-12T18:00:00.000Z"
      };
    }

    if (channel === IPC_CHANNELS.systemRestoreBackup) {
      return {
        backupDirectory: "C:\\Backups\\rayzen-pdv-backup-2026-03-12T18-00-00.000Z",
        manifestFilePath: "C:\\Backups\\rayzen-pdv-backup-2026-03-12T18-00-00.000Z\\backup-manifest.json",
        restoredArtifacts: [
          {
            kind: "DATABASE",
            relativePath: "data\\rayzen-pdv.sqlite"
          }
        ],
        restoredAt: "2026-03-12T18:05:00.000Z",
        databaseReady: true,
        integrityCheck: "ok",
        requiresRestart: true
      };
    }

    if (channel === IPC_CHANNELS.backupCreate) {
      return this.invoke(IPC_CHANNELS.systemCreateBackup, payload);
    }

    if (channel === IPC_CHANNELS.backupList) {
      return [
        {
          backupDirectory: "C:\\Backups\\rayzen-pdv-backup-2026-03-12T18-00-00.000Z",
          manifestFilePath: "C:\\Backups\\rayzen-pdv-backup-2026-03-12T18-00-00.000Z\\backup-manifest.json",
          createdAt: "2026-03-12T18:00:00.000Z",
          appVersion: "0.1.0-test",
          environment: "test",
          artifactCount: 3,
          databaseFileName: "rayzen-pdv.sqlite",
          restorable: true,
          issues: []
        }
      ];
    }

    if (channel === IPC_CHANNELS.backupRestore) {
      return this.invoke(IPC_CHANNELS.systemRestoreBackup, payload);
    }

    if (channel === IPC_CHANNELS.setupGetStatus) {
      return {
        firstRunPending: true,
        configFilePath: "C:\\ProgramData\\RayzenPDV\\config\\runtime-config.json",
        appVersion: "0.1.0-test",
        completedAt: null,
        company: null,
        printRoutes: [
          {
            setor: "COZINHA",
            impressoras: ["IMP_COZINHA_01"]
          },
          {
            setor: "BAR",
            impressoras: ["IMP_BAR_01"]
          },
          {
            setor: "CAIXA",
            impressoras: ["IMP_CAIXA_01"]
          }
        ],
        seedState: {
          adminReady: true,
          productCount: 4,
          printRouteCount: 3
        }
      };
    }

    if (channel === IPC_CHANNELS.setupCompleteFirstRun) {
      return {
        firstRunPending: false,
        configFilePath: "C:\\ProgramData\\RayzenPDV\\config\\runtime-config.json",
        appVersion: "0.1.0-test",
        completedAt: payload?.occurredAt ?? "2026-03-12T17:59:00.000Z",
        company: {
          legalName: payload?.companyLegalName ?? "Rayzen Restaurante Matriz",
          tradeName: payload?.companyTradeName ?? "Rayzen Bar",
          document: payload?.companyDocument ?? "12.345.678/0001-99"
        },
        printRoutes: [
          {
            setor: "COZINHA",
            impressoras: [payload?.printers?.cozinha ?? "IMP_COZINHA_01"]
          },
          {
            setor: "BAR",
            impressoras: [payload?.printers?.bar ?? "IMP_BAR_01"]
          },
          {
            setor: "CAIXA",
            impressoras: [payload?.printers?.caixa ?? "IMP_CAIXA_01"]
          }
        ],
        seedState: {
          adminReady: true,
          productCount: 4,
          printRouteCount: 3
        }
      };
    }

    if (channel === IPC_CHANNELS.authLogin) {
      if (payload?.pin !== "1234") {
        return {
          ok: false,
          failure: {
            code: "PIN_INVALID",
            message: "PIN local invalido. Tente novamente."
          }
        };
      }

      return {
        ok: true,
        session: {
          operatorId: "opr_admin_01",
          operatorCode: "ADMIN",
          displayLabel: "ADMIN",
          role: "GERENTE",
          authenticatedAt: "2026-03-12T18:00:00.000Z"
        }
      };
    }

    if (channel === IPC_CHANNELS.authGetSession) {
      return {
        operatorId: "opr_admin_01",
        operatorCode: "ADMIN",
        displayLabel: "ADMIN",
        role: "GERENTE",
        authenticatedAt: "2026-03-12T18:00:00.000Z"
      };
    }

    if (channel === IPC_CHANNELS.authLogout) {
      return;
    }

    if (channel === IPC_CHANNELS.catalogListProducts) {
      return [
        {
          productId: "prod_hamburguer",
          label: "Hamburguer",
          setor: "COZINHA",
          unitPriceCents: 2800,
          shortcutHint: "L1",
          category: "Lanches"
        },
        {
          productId: "prod_batata_frita",
          label: "Batata frita",
          setor: "COZINHA",
          unitPriceCents: 1600,
          shortcutHint: "L2",
          category: "Lanches"
        },
        {
          productId: "prod_refrigerante",
          label: "Refrigerante",
          setor: "BAR",
          unitPriceCents: 900,
          shortcutHint: "B1",
          category: "Bebidas"
        },
        {
          productId: "prod_cerveja",
          label: "Cerveja",
          setor: "BAR",
          unitPriceCents: 1200,
          shortcutHint: "B2",
          category: "Bebidas"
        }
      ];
    }

    if (channel === IPC_CHANNELS.catalogGetProduct) {
      return {
        productId: payload?.productId ?? "prod_hamburguer",
        label: "Hamburguer",
        setor: "COZINHA",
        unitPriceCents: 2800,
        shortcutHint: "L1",
        category: "Lanches"
      };
    }

    if (channel === IPC_CHANNELS.pdvGetOperationalSnapshot) {
      const currentComanda = {
        comandaId: "cmd_601",
        numero: "601",
        mesaId: "M20",
        atendimentoRef: null,
        status: "EM_PAGAMENTO",
        openedAt: "2026-03-12T18:00:00.000Z",
        currentOwnerUserId: "opr_gc_01",
        cancelledAt: null,
        cancellationReason: null,
        closedAt: null,
        items: [],
        payments: [],
        preContas: [],
        productionBatches: []
      };

      return {
        comanda: {
          currentComanda,
          activeComandas: [currentComanda],
          mesaGroups: [
            {
              mesaId: "M20",
              comandas: [currentComanda],
              comandaCount: 1,
              itemCount: 0,
              totalAmountCents: 0,
              paidAmountCents: 0,
              dueAmountCents: 0,
              statuses: ["EM_PAGAMENTO"]
            }
          ],
          auditTrail: [],
          lastPreContaSnapshot: null
        },
        cash: {
          currentSession: null,
          auditTrail: [],
          auditExport: null
        }
      };
    }

    if (channel === IPC_CHANNELS.cashGetStatus) {
      return {
        currentSession: {
          cashSessionId: "cash_601",
          terminalId: "pdv-main",
          openedBy: {
            userId: "opr_admin_01",
            terminalId: "pdv-main",
            role: "GERENTE"
          },
          openedAt: "2026-03-12T18:00:00.000Z",
          openingFundAmountCents: 15000,
          openingReason: "troco inicial",
          status: "ABERTO",
          closingStartedAt: null,
          closedAt: null,
          movements: [],
          closure: null
        },
        auditTrail: [],
        auditExport: {
          session: {
            cashSessionId: "cash_601",
            terminalId: "pdv-main",
            status: "ABERTO",
            openedAt: "2026-03-12T18:00:00.000Z",
            closedAt: null,
            openedByUserId: "opr_admin_01"
          },
          totals: {
            totalExpectedAmountCents: 19700,
            totalCountedAmountCents: 0,
            totalDivergenceAmountCents: -19700,
            openingFundAmountCents: 15000,
            movementCount: 1,
            byMethod: []
          },
          movements: [],
          closure: null,
          auditTrail: []
        }
      };
    }

    if (channel === IPC_CHANNELS.cashGetSummary) {
      return {
        session: {
          cashSessionId: "cash_601",
          terminalId: "pdv-main",
          status: "ABERTO",
          openedAt: "2026-03-12T18:00:00.000Z",
          closedAt: null,
          openedByUserId: "opr_admin_01"
        },
        totals: {
          totalExpectedAmountCents: 19700,
          totalCountedAmountCents: 0,
          totalDivergenceAmountCents: -19700,
          openingFundAmountCents: 15000,
          movementCount: 1,
          byMethod: []
        },
        movements: [],
        closure: null,
        auditTrail: []
      };
    }

    if (channel === IPC_CHANNELS.fiscalGetStatus) {
      return {
        emitters: [
          {
            emitterId: "emit_sp_1",
            provider: "NS_TECNOLOGIA",
            environment: "HOMOLOGACAO",
            stateCode: "SP",
            documentModel: "65",
            legalName: "Rayzen Restaurante Teste",
            cnpj: "12345678000199",
            stateRegistration: "123456789000",
            cscId: "CSC-HMG-01",
            certificateSubject: null,
            certificateValidFrom: null,
            certificateValidUntil: null,
            status: "HABILITADO",
            hasSecrets: true,
            updatedAt: "2026-03-12T17:00:00.000Z"
          }
        ],
        pendingQueue: [],
        recentDocuments: []
      };
    }

    if (channel === IPC_CHANNELS.fiscalListPending) {
      return [
        {
          fiscalQueueId: "fq_nfce_900",
          fiscalDocId: "nfce_900",
          emitterId: "emit_sp_1",
          terminalId: "pdv-main",
          referenceType: "COMANDA",
          referenceId: "cmd_900",
          provider: "NS_TECNOLOGIA",
          environment: "HOMOLOGACAO",
          documentModel: "65",
          status: "CONTINGENCY",
          emissionMode: "CONTINGENCY_OFFLINE",
          attempts: 1,
          contingencyRequired: true,
          contingencyStartedAt: "2026-03-12T18:06:00.000Z",
          leaseExpiresAt: null,
          nextRetryAt: "2026-03-12T18:10:00.000Z",
          lastErrorCode: "NS_TIMEOUT",
          lastErrorMessage: "Sem resposta do provider NS.",
          issuedAt: "2026-03-12T18:06:00.000Z",
          authorizedAt: null,
          lastStatusCheckedAt: "2026-03-12T18:08:00.000Z",
          createdAt: "2026-03-12T18:05:00.000Z",
          updatedAt: "2026-03-12T18:08:00.000Z"
        }
      ];
    }

    if (channel === IPC_CHANNELS.fiscalGetDocumentStatus) {
      return {
        fiscalDocId: payload?.fiscalDocId ?? "nfce_900",
        emitterId: "emit_sp_1",
        terminalId: "pdv-main",
        referenceType: "COMANDA",
        referenceId: "cmd_900",
        provider: "NS_TECNOLOGIA",
        environment: "HOMOLOGACAO",
        stateCode: "SP",
        documentModel: "65",
        serie: "1",
        numero: 900,
        accessKey: "35965001000000000000000000000000000000000000",
        nsReferenceId: "nsref_nfce_900",
        status: "CONTINGENCY",
        emissionMode: "CONTINGENCY_OFFLINE",
        contingencyRequired: true,
        contingencyStartedAt: "2026-03-12T18:06:00.000Z",
        contingencyJustification: "Timeout no canal de autorizacao.",
        contingencyPrintedAt: "2026-03-12T18:06:00.000Z",
        contingencyDanfePath: "C:\\ProgramData\\RayzenPDV\\fiscal\\danfe\\emit_sp_1\\35965001000000000000000000000000000000000000-contingencia.txt",
        lastErrorCode: "NS_TIMEOUT",
        lastErrorMessage: "Sem resposta do provider NS.",
        issuedAt: "2026-03-12T18:06:00.000Z",
        authorizedAt: null,
        lastStatusCheckedAt: "2026-03-12T18:08:00.000Z",
        xmlStoragePath: null,
        updatedAt: "2026-03-12T18:08:00.000Z"
      };
    }

    if (channel === IPC_CHANNELS.fiscalReprocess) {
      return {
        processedCount: 1,
        authorizedCount: 1,
        rejectedCount: 0,
        pendingCount: 0,
        contingencyCount: 0,
        jobs: [
          {
            fiscalQueueId: "fq_nfce_900",
            fiscalDocId: "nfce_900",
            emitterId: "emit_sp_1",
            terminalId: "pdv-main",
            referenceType: "COMANDA",
            referenceId: "cmd_900",
            provider: "NS_TECNOLOGIA",
            environment: "HOMOLOGACAO",
            documentModel: "65",
            status: "AUTHORIZED",
            emissionMode: "CONTINGENCY_OFFLINE",
            attempts: 2,
            contingencyRequired: true,
            contingencyStartedAt: "2026-03-12T18:06:00.000Z",
            leaseExpiresAt: null,
            nextRetryAt: null,
            lastErrorCode: null,
            lastErrorMessage: null,
            issuedAt: "2026-03-12T18:06:00.000Z",
            authorizedAt: "2026-03-12T18:07:00.000Z",
            lastStatusCheckedAt: "2026-03-12T18:08:30.000Z",
            createdAt: "2026-03-12T18:05:00.000Z",
            updatedAt: "2026-03-12T18:08:30.000Z"
          }
        ]
      };
    }

    if (channel === IPC_CHANNELS.fiscalQueryStatusByAccessKey) {
      return {
        fiscalDocId: "nfce_900",
        emitterId: "emit_sp_1",
        terminalId: "pdv-main",
        referenceType: "COMANDA",
        referenceId: "cmd_900",
        provider: "NS_TECNOLOGIA",
        environment: "HOMOLOGACAO",
        stateCode: "SP",
        documentModel: "65",
        serie: "1",
        numero: 900,
        accessKey: "35965001000000000000000000000000000000000000",
        nsReferenceId: "nsref_nfce_900",
        status: "AUTHORIZED",
        emissionMode: "CONTINGENCY_OFFLINE",
        contingencyRequired: true,
        contingencyStartedAt: "2026-03-12T18:06:00.000Z",
        contingencyJustification: "Timeout no canal de autorizacao.",
        contingencyPrintedAt: "2026-03-12T18:06:00.000Z",
        contingencyDanfePath: "C:\\ProgramData\\RayzenPDV\\fiscal\\danfe\\emit_sp_1\\35965001000000000000000000000000000000000000-contingencia.txt",
        lastErrorCode: null,
        lastErrorMessage: null,
        issuedAt: "2026-03-12T18:06:00.000Z",
        authorizedAt: "2026-03-12T18:07:00.000Z",
        lastStatusCheckedAt: "2026-03-12T18:08:00.000Z",
        xmlStoragePath: "C:\\ProgramData\\RayzenPDV\\fiscal\\xml\\emit_sp_1\\35965001000000000000000000000000000000000000.xml",
        updatedAt: "2026-03-12T18:08:00.000Z"
      };
    }

    if (channel === IPC_CHANNELS.printListPrinters) {
      return [
        {
          printerId: "IMP_BAR_01",
          printerName: "IMP_BAR_01",
          isOffline: false,
          isAvailable: true,
          status: "Idle"
        }
      ];
    }

    if (channel === IPC_CHANNELS.printGetStatus) {
      return {
        routes: [
          {
            setor: "COZINHA",
            impressoras: ["IMP_COZINHA_01"]
          },
          {
            setor: "BAR",
            impressoras: ["IMP_BAR_01"]
          }
        ],
        pendingJobs: []
      };
    }

    if (channel === IPC_CHANNELS.printListJobs) {
      return [
        {
          printJobId: "job_123",
          sourceEntity: "COMANDA",
          sourceEntityId: "cmd_123",
          setor: "COZINHA",
          status: "WAITING_PRINTER",
          ticketKind: "PRODUCAO",
          printerTargetId: "IMP_COZINHA_01",
          printerTargetName: "IMP_COZINHA_01",
          secondCopyOfJobId: null,
          attempts: 2,
          secondCopyCount: 0,
          lastErrorCode: "PRINTER_OFFLINE",
          lastErrorMessage: "Impressora offline.",
          nextRetryAt: "2026-03-12T18:10:00.000Z",
          lastAttemptAt: "2026-03-12T18:05:00.000Z",
          printedAt: null,
          createdAt: "2026-03-12T18:00:00.000Z",
          updatedAt: "2026-03-12T18:05:00.000Z"
        }
      ];
    }

    if (channel === IPC_CHANNELS.printReprocessJob) {
      return {
        printJobId: payload?.printJobId ?? "job_123",
        sourceEntity: "COMANDA",
        sourceEntityId: "cmd_123",
        setor: "COZINHA",
        status: "QUEUED",
        ticketKind: "PRODUCAO",
        printerTargetId: "IMP_COZINHA_01",
        printerTargetName: "IMP_COZINHA_01",
        secondCopyOfJobId: null,
        attempts: 2,
        secondCopyCount: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        nextRetryAt: null,
        lastAttemptAt: "2026-03-12T18:09:00.000Z",
        printedAt: null,
        createdAt: "2026-03-12T18:00:00.000Z",
        updatedAt: "2026-03-12T18:09:00.000Z"
      };
    }

    return {
      filePath: "C:\\ProgramData\\RayzenPDV\\data\\rayzen-pdv.sqlite",
      walMode: "enabled",
      journalMode: "wal",
      appliedMigrations: [],
      pendingMigrationVersions: []
    };
  }
}

class FakeSafeStorage {
  isEncryptionAvailable() {
    return true;
  }

  encryptString(plainText) {
    return Buffer.from(`enc:${plainText}`, "utf8");
  }

  decryptString(cipherText) {
    return cipherText.toString("utf8").replace(/^enc:/, "");
  }
}

class FakeFiscalProvider {
  issueResults;
  queryResults;

  constructor(options) {
    this.issueResults = [...(options.issueResults ?? [])];
    this.queryResults = [...(options.queryResults ?? [])];
  }

  async issueNfce() {
    if (this.issueResults.length === 0) {
      throw new Error("No fake issue result configured.");
    }

    return this.issueResults.shift();
  }

  async queryStatusByAccessKey() {
    if (this.queryResults.length === 0) {
      throw new Error("No fake query result configured.");
    }

    return this.queryResults.shift();
  }
}

class FakeContextBridge {
  apiKey = null;
  api = null;

  exposeInMainWorld(apiKey, api) {
    this.apiKey = apiKey;
    this.api = api;
  }
}

class FakeBrowserWindow {
  static #allWindows = [];

  static getAllWindows() {
    return FakeBrowserWindow.#allWindows;
  }

  options;
  loadedFiles = [];
  #listeners = new Map();

  constructor(options) {
    this.options = options;
    FakeBrowserWindow.#allWindows.push(this);
  }

  loadFile(filePath) {
    this.loadedFiles.push(filePath);
  }

  on(event, listener) {
    this.#listeners.set(event, listener);
  }

  show() {}
}

function safeRemoveDirectory(targetPath) {
  fs.rmSync(targetPath, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 50
  });
}

export async function runAllElectronMainTests() {
  runPathScenario();
  runLogScenario();
  runPrintServiceScenario();
  runPrintRetryScenario();
  await runFiscalServiceScenario();
  await runFiscalContingencyScenario();
  runSupportServiceScenario();
  runInstallationScenario();
  await runIpcScenario();
  await runPreloadScenario();
  runWindowScenario();
  runBundledWindowScenario();

  console.log("[electron] 12 runtime checks passed.");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await runAllElectronMainTests();
}
