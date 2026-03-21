import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  createRayzenDatabaseClient,
  getSqliteSidecarPaths,
  hashPin,
  initializeRayzenDatabase,
  loadMigrations,
  seedInitialFoundationIfEmpty
} from "../dist/index.js";

export function runBaselineScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-db-"));

  try {
    const databasePath = path.join(tempRoot, "rayzen-pdv.sqlite");
    const client = initializeRayzenDatabase({
      filePath: databasePath,
      walMode: "enabled"
    });

    try {
      const tableNames = client.raw
        .prepare(
          `
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            ORDER BY name ASC
          `
        )
        .all()
        .map((row) => row.name);

      const journalMode = client.raw.prepare("PRAGMA journal_mode").get().journal_mode;

      assert.equal(
        JSON.stringify([...tableNames].sort()),
        JSON.stringify(
          [
            "audit_events",
            "cash_movements",
            "cash_sessions",
            "comanda_items",
            "comanda_payments",
            "comanda_precontas",
            "comandas",
            "fiscal_document_events",
            "fiscal_documents",
            "fiscal_emitters",
            "fiscal_queue",
            "operator_sessions",
            "operators",
            "print_sector_routing",
            "print_jobs",
            "products",
            "schema_migrations"
          ].sort()
        )
      );
      assert.equal(String(journalMode).toLowerCase(), "wal");
    } finally {
      client.close();
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function runComandaRepositoryScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-db-comanda-"));

  try {
    const client = initializeRayzenDatabase({
      filePath: path.join(tempRoot, "rayzen-pdv.sqlite")
    });

    try {
      const persisted = client.comandas.saveAggregate({
        comanda: {
          comandaId: "cmd_100",
          numero: "100",
          mesaId: "M12",
          atendimentoRef: null,
          status: "EM_PAGAMENTO",
          currentOwnerUserId: "opr_gc_01",
          openedAt: "2026-03-12T10:00:00.000Z",
          closedAt: null,
          cancelledAt: null,
          cancellationReason: null,
          subtotalAmountCents: 6200,
          paidAmountCents: 0,
          changeAmountCents: 0,
          productionBatches: [
            {
              batchId: "batch_1",
              sentAt: "2026-03-12T10:03:00.000Z",
              setores: ["BAR", "COZINHA"],
              sentItemIds: ["item_1", "item_2"]
            }
          ]
        },
        items: [
          {
            itemId: "item_1",
            comandaId: "cmd_100",
            produtoId: "prod_1",
            productLabel: "Suco de laranja",
            setor: "BAR",
            quantity: 2,
            unitPriceCents: 1500,
            status: "ENVIADO",
            note: null,
            productionBatchId: "batch_1",
            createdAt: "2026-03-12T10:01:00.000Z",
            sentAt: "2026-03-12T10:03:00.000Z",
            cancelledAt: null,
            cancellationReason: null
          },
          {
            itemId: "item_2",
            comandaId: "cmd_100",
            produtoId: "prod_2",
            productLabel: "Prato executivo",
            setor: "COZINHA",
            quantity: 1,
            unitPriceCents: 3200,
            status: "ENVIADO",
            note: null,
            productionBatchId: "batch_1",
            createdAt: "2026-03-12T10:02:00.000Z",
            sentAt: "2026-03-12T10:03:00.000Z",
            cancelledAt: null,
            cancellationReason: null
          }
        ],
        payments: [],
        preContas: [
          {
            preContaId: "pre_1",
            comandaId: "cmd_100",
            version: 1,
            totalAmountCents: 6200,
            snapshot: {
              totalAmountCents: 6200,
              itemCount: 2
            },
            generatedAt: "2026-03-12T10:04:00.000Z"
          }
        ],
        auditEvents: [
          {
            eventId: "evt_open_100",
            entity: "COMANDA",
            entityId: "cmd_100",
            action: "COMANDA_ABERTA",
            actorUserId: "opr_gc_01",
            actorTerminalId: "term_1",
            actorRole: "GARCOM",
            occurredAt: "2026-03-12T10:00:00.000Z",
            payload: {
              numero: "100"
            }
          },
          {
            eventId: "evt_pre_100",
            entity: "COMANDA",
            entityId: "cmd_100",
            action: "PRE_CONTA_GERADA",
            actorUserId: "opr_gc_01",
            actorTerminalId: "term_1",
            actorRole: "GARCOM",
            occurredAt: "2026-03-12T10:04:00.000Z",
            payload: {
              version: 1,
              totalAmountCents: 6200
            }
          }
        ]
      });

      const loaded = client.comandas.findById("cmd_100");
      const auditTrail = client.auditEvents.findByEntity("COMANDA", "cmd_100");

      assert.ok(loaded);
      assert.equal(persisted.comanda.status, "EM_PAGAMENTO");
      assert.equal(loaded?.items.length, 2);
      assert.equal(loaded?.preContas[0].version, 1);
      assert.equal(auditTrail.length, 2);
      assert.deepEqual(loaded?.comanda.productionBatches, [
        {
          batchId: "batch_1",
          sentAt: "2026-03-12T10:03:00.000Z",
          setores: ["BAR", "COZINHA"],
          sentItemIds: ["item_1", "item_2"]
        }
      ]);
    } finally {
      client.close();
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function runRepositoriesScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-db-"));

  try {
    const client = initializeRayzenDatabase({
      filePath: path.join(tempRoot, "rayzen-pdv.sqlite")
    });

    try {
      const auditEvent = client.auditEvents.append({
        eventId: "evt_1",
        entity: "COMANDA",
        entityId: "cmd_1",
        action: "COMANDA_ABERTA",
        actorUserId: "usr_1",
        actorTerminalId: "term_1",
        occurredAt: "2026-03-11T10:00:00.000Z",
        payload: { numero: "101" }
      });

      const printJob = client.printSpool.enqueue({
        printJobId: "pj_1",
        sourceEntity: "COMANDA",
        sourceEntityId: "cmd_1",
        setor: "COZINHA",
        dedupKey: "cmd_1:cozinha:1",
        payload: { itens: [{ sku: "produto-1", qtd: 2 }] }
      });

      const fiscalItem = client.fiscalQueue.enqueue({
        fiscalQueueId: "fq_1",
        fiscalDocId: "nfce_1",
        provider: "NS_TECNOLOGIA",
        documentType: "NFCE_65",
        payload: { serie: "1" },
        context: { ambiente: "homolog" },
        contingencyRequired: false
      });

      assert.deepEqual(auditEvent.payload, { numero: "101" });
      assert.equal(printJob.status, "QUEUED");
      assert.equal(client.printSpool.listPending().length, 1);
      assert.equal(fiscalItem.status, "DRAFT");
      assert.equal(client.fiscalQueue.listPending().length, 1);
    } finally {
      client.close();
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function runPrintSpoolRoutingScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-db-print-"));

  try {
    const client = initializeRayzenDatabase({
      filePath: path.join(tempRoot, "rayzen-pdv.sqlite")
    });

    try {
      const firstJob = client.printSpool.enqueue({
        printJobId: "pj_route_1",
        sourceEntity: "COMANDA",
        sourceEntityId: "cmd_55",
        setor: "COZINHA",
        ticketKind: "PRODUCAO",
        dedupKey: "cmd_55:batch_1:COZINHA:PRODUCAO",
        printerTargetId: "IMP_COZINHA_01",
        printerTargetName: "IMP_COZINHA_01",
        payload: {
          header: {
            kind: "PRODUCAO",
            printJobId: "pj_route_1",
            batchId: "batch_1",
            setor: "COZINHA",
            comandaNumero: "55",
            mesaId: "M10",
            requestedAt: "2026-03-12T14:00:00.000Z",
            actor: {
              userId: "opr_gc_01",
              terminalId: "term_1",
              role: "GARCOM"
            }
          },
          items: [
            {
              itemId: "item_1",
              productLabel: "Prato executivo",
              quantity: 1,
              note: null
            }
          ]
        }
      });

      const duplicatedJob = client.printSpool.enqueue({
        printJobId: "pj_route_duplicate",
        sourceEntity: "COMANDA",
        sourceEntityId: "cmd_55",
        setor: "COZINHA",
        ticketKind: "PRODUCAO",
        dedupKey: "cmd_55:batch_1:COZINHA:PRODUCAO",
        payload: {
          header: {
            kind: "PRODUCAO",
            printJobId: "pj_route_duplicate",
            batchId: "batch_1",
            setor: "COZINHA",
            comandaNumero: "55",
            mesaId: "M10",
            requestedAt: "2026-03-12T14:00:00.000Z",
            actor: {
              userId: "opr_gc_01",
              terminalId: "term_1",
              role: "GARCOM"
            }
          },
          items: []
        }
      });

      const claimed = client.printSpool.claimNextReady({
        asOf: "2026-03-12T14:00:00.000Z",
        leaseExpiresAt: "2026-03-12T14:00:45.000Z"
      });

      assert.equal(firstJob.ticketKind, "PRODUCAO");
      assert.equal(firstJob.printerTargetName, "IMP_COZINHA_01");
      assert.equal(duplicatedJob.printJobId, firstJob.printJobId);
      assert.equal(claimed?.status, "PRINTING");

      const waiting = client.printSpool.registerAttempt({
        printJobId: firstJob.printJobId,
        status: "WAITING_PRINTER",
        incrementAttempts: true,
        lastErrorCode: "PRINTER_OFFLINE",
        lastErrorMessage: "Impressora offline.",
        lastAttemptAt: "2026-03-12T14:00:00.000Z",
        nextRetryAt: "2026-03-12T14:02:00.000Z",
        leaseExpiresAt: null
      });

      const unavailableBeforeRetry = client.printSpool.claimNextReady({
        asOf: "2026-03-12T14:01:00.000Z",
        leaseExpiresAt: "2026-03-12T14:01:45.000Z"
      });
      const reclaimed = client.printSpool.claimNextReady({
        asOf: "2026-03-12T14:03:00.000Z",
        leaseExpiresAt: "2026-03-12T14:03:45.000Z"
      });

      const secondCopy = client.printSpool.createSecondCopy({
        originalJobId: firstJob.printJobId,
        secondCopyJobId: "pj_route_2",
        queuedAt: "2026-03-12T14:04:00.000Z"
      });
      const originalAfterSecondCopy = client.printSpool.findById(firstJob.printJobId);

      assert.equal(waiting.status, "WAITING_PRINTER");
      assert.equal(unavailableBeforeRetry, null);
      assert.equal(reclaimed?.printJobId, firstJob.printJobId);
      assert.equal(secondCopy.ticketKind, "SEGUNDA_VIA");
      assert.equal(secondCopy.secondCopyOfJobId, firstJob.printJobId);
      assert.equal(originalAfterSecondCopy.secondCopyCount, 1);
    } finally {
      client.close();
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function runCashSessionRepositoryScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-db-cash-"));

  try {
    const client = initializeRayzenDatabase({
      filePath: path.join(tempRoot, "rayzen-pdv.sqlite")
    });

    try {
      const persisted = client.cashSessions.saveAggregate({
        session: {
          cashSessionId: "cash_1",
          terminalId: "pdv-main",
          openedByUserId: "opr_cx_01",
          openedByTerminalId: "pdv-main",
          openedByRole: "CAIXA",
          openedAt: "2026-03-12T18:00:00.000Z",
          openingFundAmountCents: 15000,
          openingReason: "troco inicial",
          status: "FECHADO",
          closingStartedAt: "2026-03-12T22:50:00.000Z",
          closedAt: "2026-03-12T23:00:00.000Z",
          closedByUserId: "opr_cx_01",
          closedByTerminalId: "pdv-main",
          closedByRole: "CAIXA",
          closureNote: "turno da noite",
          divergenceReason: "faltou um comprovante",
          closureSummary: {
            totalExpectedAmountCents: 35000,
            totalCountedAmountCents: 34900,
            totalDivergenceAmountCents: -100
          }
        },
        movements: [
          {
            cashMovementId: "cash_mov_1",
            cashSessionId: "cash_1",
            movementType: "RECEBIMENTO",
            paymentMethod: "PIX",
            amountCents: 20000,
            reason: "checkout comanda 101",
            sourceEntity: "COMANDA",
            sourceEntityId: "cmd_101",
            occurredAt: "2026-03-12T20:00:00.000Z",
            actorUserId: "opr_cx_01",
            actorTerminalId: "pdv-main",
            actorRole: "CAIXA"
          },
          {
            cashMovementId: "cash_mov_2",
            cashSessionId: "cash_1",
            movementType: "SANGRIA",
            paymentMethod: "DINHEIRO",
            amountCents: 5000,
            reason: "retirada do excesso",
            sourceEntity: null,
            sourceEntityId: null,
            occurredAt: "2026-03-12T21:00:00.000Z",
            actorUserId: "opr_cx_01",
            actorTerminalId: "pdv-main",
            actorRole: "CAIXA"
          }
        ],
        auditEvents: [
          {
            eventId: "evt_cash_open_1",
            entity: "CAIXA",
            entityId: "cash_1",
            action: "CAIXA_ABERTO",
            actorUserId: "opr_cx_01",
            actorTerminalId: "pdv-main",
            actorRole: "CAIXA",
            occurredAt: "2026-03-12T18:00:00.000Z",
            payload: {
              openingFundAmountCents: 15000
            }
          },
          {
            eventId: "evt_cash_close_1",
            entity: "CAIXA",
            entityId: "cash_1",
            action: "CAIXA_FECHADO",
            actorUserId: "opr_cx_01",
            actorTerminalId: "pdv-main",
            actorRole: "CAIXA",
            occurredAt: "2026-03-12T23:00:00.000Z",
            payload: {
              totalDivergenceAmountCents: -100
            }
          }
        ]
      });

      const loaded = client.cashSessions.findById("cash_1");
      const active = client.cashSessions.findActiveByTerminalId("pdv-main");
      const exportBundle = client.cashSessions.exportAuditBundle("cash_1");

      assert.equal(persisted.session.status, "FECHADO");
      assert.equal(loaded?.movements.length, 2);
      assert.equal(active, null);
      assert.equal(exportBundle.auditEvents.length, 2);
      assert.equal(exportBundle.session.divergenceReason, "faltou um comprovante");
    } finally {
      client.close();
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function runFiscalTrailScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-db-fiscal-"));

  try {
    const client = initializeRayzenDatabase({
      filePath: path.join(tempRoot, "rayzen-pdv.sqlite")
    });

    try {
      client.fiscal.upsertEmitter({
        emitter: {
          emitterId: "emit_sp_1",
          provider: "NS_TECNOLOGIA",
          environment: "HOMOLOGACAO",
          stateCode: "SP",
          documentModel: "65",
          certificateKind: "E_CNPJ_A1",
          legalName: "Rayzen Restaurante Teste",
          tradeName: "Rayzen Unidade Centro",
          cnpj: "12345678000199",
          stateRegistration: "123456789000",
          cscId: "CSC-HMG-01",
          certificateSubject: "CN=RAYZEN TESTE",
          certificateValidFrom: "2026-03-01T00:00:00.000Z",
          certificateValidUntil: "2027-03-01T00:00:00.000Z",
          status: "HABILITADO",
          settings: {
            nsTenant: "tenant-sp"
          }
        }
      });

      const draft = client.fiscal.saveDraft({
        document: {
          fiscalDocId: "nfce_100",
          emitterId: "emit_sp_1",
          terminalId: "pdv-main",
          referenceType: "COMANDA",
          referenceId: "cmd_100",
          provider: "NS_TECNOLOGIA",
          environment: "HOMOLOGACAO",
          stateCode: "SP",
          documentModel: "65",
          serie: "1",
          numero: 100,
          accessKey: null,
          nsReferenceId: null,
          status: "DRAFT",
          emissionMode: "NORMAL",
          contingencyRequired: false,
          contingencyStartedAt: null,
          contingencyJustification: null,
          contingencyPrintedAt: null,
          contingencyDanfePath: null,
          payload: {
            totalAmountCents: 6200
          },
          response: {},
          xmlStoragePath: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          issuedAt: null,
          authorizedAt: null,
          lastStatusCheckedAt: null
        },
        queue: {
          fiscalQueueId: "fq_nfce_100",
          fiscalDocId: "nfce_100",
          emitterId: "emit_sp_1",
          terminalId: "pdv-main",
          provider: "NS_TECNOLOGIA",
          environment: "HOMOLOGACAO",
          stateCode: "SP",
          documentModel: "65",
          documentType: "NFCE_65",
          referenceType: "COMANDA",
          referenceId: "cmd_100",
          serie: "1",
          numero: 100,
          accessKey: null,
          status: "DRAFT",
          emissionMode: "NORMAL",
          dedupKey: "emit_sp_1:1:100",
          payload: {
            totalAmountCents: 6200
          },
          context: {
            queuedAt: "2026-03-12T19:00:00.000Z"
          },
          contingencyRequired: false,
          contingencyStartedAt: null,
          providerReferenceId: null,
          leaseExpiresAt: null,
          nextRetryAt: null,
          issuedAt: null,
          authorizedAt: null,
          lastStatusCheckedAt: null
        },
        initialEvent: {
          fiscalEventId: "fevt_nfce_100_draft",
          fiscalDocId: "nfce_100",
          emitterId: "emit_sp_1",
          eventType: "FISCAL_DOCUMENT_ENQUEUED",
          status: "DRAFT",
          provider: "NS_TECNOLOGIA",
          providerReferenceId: null,
          occurredAt: "2026-03-12T19:00:00.000Z",
          payload: {
            serie: "1",
            numero: 100
          }
        },
        auditEvents: [
          {
            eventId: "evt_nfce_100_draft",
            entity: "FISCAL_DOCUMENT",
            entityId: "nfce_100",
            action: "FISCAL_DOCUMENTO_ENFILEIRADO",
            actorUserId: "opr_cx_01",
            actorTerminalId: "pdv-main",
            actorRole: "CAIXA",
            occurredAt: "2026-03-12T19:00:00.000Z",
            payload: {
              serie: "1",
              numero: 100
            }
          }
        ]
      });

      const claimed = client.fiscalQueue.claimNextReady({
        asOf: "2026-03-12T19:05:00.000Z",
        leaseExpiresAt: "2026-03-12T19:05:30.000Z"
      });
      const authorized = client.fiscal.appendState({
        fiscalDocId: "nfce_100",
        fiscalQueueId: "fq_nfce_100",
        status: "AUTHORIZED",
        event: {
          fiscalEventId: "fevt_nfce_100_authorized",
          emitterId: "emit_sp_1",
          eventType: "FISCAL_DOCUMENT_AUTHORIZED",
          status: "AUTHORIZED",
          provider: "NS_TECNOLOGIA",
          providerReferenceId: "nsref_nfce_100",
          occurredAt: "2026-03-12T19:06:00.000Z",
          payload: {
            protocolNumber: "135260000000100"
          }
        },
        providerReferenceId: "nsref_nfce_100",
        accessKey: "35106500100000000000000000000000000000000000",
        response: {
          protocolNumber: "135260000000100"
        },
        xmlStoragePath: "C:\\ProgramData\\RayzenPDV\\fiscal\\xml\\emit_sp_1\\35106500100000000000000000000000000000000000.xml",
        issuedAt: "2026-03-12T19:05:00.000Z",
        authorizedAt: "2026-03-12T19:06:00.000Z",
        lastStatusCheckedAt: "2026-03-12T19:06:00.000Z",
        leaseExpiresAt: null
      });
      const byReference = client.fiscal.findLatestDocumentByReference("COMANDA", "cmd_100");
      const nextNumber = client.fiscal.getNextDocumentNumber("emit_sp_1", "1");
      const auditTrail = client.auditEvents.findByEntity("FISCAL_DOCUMENT", "nfce_100");

      assert.equal(draft.document.status, "DRAFT");
      assert.equal(claimed?.fiscalDocId, "nfce_100");
      assert.equal(authorized.document.status, "AUTHORIZED");
      assert.equal(authorized.document.emissionMode, "NORMAL");
      assert.equal(authorized.events.length, 2);
      assert.equal(authorized.queue?.status, "AUTHORIZED");
      assert.equal(byReference?.fiscalDocId, "nfce_100");
      assert.equal(nextNumber, 101);
      assert.equal(client.fiscal.findDocumentByAccessKey("35106500100000000000000000000000000000000000")?.fiscalDocId, "nfce_100");
      assert.equal(client.fiscal.listEmitters().length, 1);
      assert.equal(client.fiscal.listDocuments().length, 1);
      assert.equal(auditTrail.length, 1);
    } finally {
      client.close();
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function runSeedScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-db-seed-"));

  try {
    const client = initializeRayzenDatabase({
      filePath: path.join(tempRoot, "rayzen-pdv.sqlite")
    });

    try {
      seedInitialFoundationIfEmpty(client);
      seedInitialFoundationIfEmpty(client);

      const operators = client.operators.listActive();
      const products = client.products.listActive();
      const printRoutes = client.printRouting.listAll();
      const admin = client.operators.findActiveByPinHash(hashPin("1234"));

      client.operators.upsertSession({
        terminalId: "pdv-main",
        operatorId: admin.operatorId,
        loginAt: "2026-03-12T10:00:00.000Z"
      });

      const session = client.operators.findSessionByTerminalId("pdv-main");

      assert.equal(operators.length, 1);
      assert.equal(products.length, 4);
      assert.equal(printRoutes.length, 3);
      assert.equal(admin.operatorCode, "ADMIN");
      assert.equal(session?.operator.operatorId, admin.operatorId);
      assert.equal(client.products.findById("prod_hamburguer")?.nome, "Hamburguer");
      assert.equal(client.printRouting.findBySetor("COZINHA")?.printerName, "IMP_COZINHA_01");
    } finally {
      client.close();
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function runRollbackScenario() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rayzen-db-"));

  try {
    const databasePath = path.join(tempRoot, "rayzen-pdv.sqlite");
    const client = createRayzenDatabaseClient({
      filePath: databasePath,
      walMode: "disabled"
    });

    try {
      assert.equal(loadMigrations(client.config.migrationsDir).length, 8);

      client.migrateUp();
      client.migrateDown({ steps: 8 });

      const tableNames = client.raw
        .prepare(
          `
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            ORDER BY name ASC
          `
        )
        .all()
        .map((row) => row.name);

      const journalMode = client.raw.prepare("PRAGMA journal_mode").get().journal_mode;

      assert.equal(JSON.stringify(tableNames), JSON.stringify(["schema_migrations"]));
      assert.equal(String(journalMode).toLowerCase(), "delete");
      assert.deepEqual(getSqliteSidecarPaths(databasePath), [
        databasePath,
        `${databasePath}-wal`,
        `${databasePath}-shm`
      ]);
    } finally {
      client.close();
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

export function runAllDbFoundationTests() {
  runBaselineScenario();
  runRepositoriesScenario();
  runPrintSpoolRoutingScenario();
  runCashSessionRepositoryScenario();
  runFiscalTrailScenario();
  runSeedScenario();
  runComandaRepositoryScenario();
  runRollbackScenario();

  console.log("[packages/db] 8 runtime checks passed.");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runAllDbFoundationTests();
}
