import type { DatabaseSync } from "node:sqlite";

import { parseJson, serializeJson } from "../json.js";
import { executeTransaction } from "../transaction.js";
import type {
  AuditEventInput,
  CashMovementRecord,
  CashSessionRecord,
  PersistedCashSessionAggregate,
  SaveCashSessionAggregateInput
} from "../types.js";

interface CashSessionRow {
  cashSessionId: string;
  terminalId: string;
  openedByUserId: string;
  openedByTerminalId: string;
  openedByRole: string | null;
  openedAt: string;
  openingFundAmountCents: number;
  openingReason: string | null;
  status: CashSessionRecord["status"];
  closingStartedAt: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  closedByTerminalId: string | null;
  closedByRole: string | null;
  closureNote: string | null;
  divergenceReason: string | null;
  closureSummaryJson: string;
  createdAt: string;
  updatedAt: string;
}

interface CashMovementRow {
  cashMovementId: string;
  cashSessionId: string;
  movementType: CashMovementRecord["movementType"];
  paymentMethod: CashMovementRecord["paymentMethod"];
  amountCents: number;
  reason: string | null;
  sourceEntity: string | null;
  sourceEntityId: string | null;
  occurredAt: string;
  actorUserId: string;
  actorTerminalId: string;
  actorRole: string | null;
  createdAt: string;
}

export class CashSessionRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  findById(cashSessionId: string): PersistedCashSessionAggregate | null {
    const sessionRow = this.#db.prepare(
      `
        SELECT
          cash_session_id AS cashSessionId,
          terminal_id AS terminalId,
          opened_by_user_id AS openedByUserId,
          opened_by_terminal_id AS openedByTerminalId,
          opened_by_role AS openedByRole,
          opened_at AS openedAt,
          opening_fund_amount_cents AS openingFundAmountCents,
          opening_reason AS openingReason,
          status,
          closing_started_at AS closingStartedAt,
          closed_at AS closedAt,
          closed_by_user_id AS closedByUserId,
          closed_by_terminal_id AS closedByTerminalId,
          closed_by_role AS closedByRole,
          closure_note AS closureNote,
          divergence_reason AS divergenceReason,
          closure_summary_json AS closureSummaryJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM cash_sessions
        WHERE cash_session_id = :cashSessionId
      `
    ).get({ cashSessionId }) as CashSessionRow | undefined;

    if (!sessionRow) {
      return null;
    }

    const movements = (this.#db.prepare(
      `
        SELECT
          cash_movement_id AS cashMovementId,
          cash_session_id AS cashSessionId,
          movement_type AS movementType,
          payment_method AS paymentMethod,
          amount_cents AS amountCents,
          reason,
          source_entity AS sourceEntity,
          source_entity_id AS sourceEntityId,
          occurred_at AS occurredAt,
          actor_user_id AS actorUserId,
          actor_terminal_id AS actorTerminalId,
          actor_role AS actorRole,
          created_at AS createdAt
        FROM cash_movements
        WHERE cash_session_id = :cashSessionId
        ORDER BY occurred_at ASC, cash_movement_id ASC
      `
    ).all({ cashSessionId }) as unknown as CashMovementRow[]).map(mapCashMovement);

    return {
      session: mapCashSession(sessionRow),
      movements
    };
  }

  findActiveByTerminalId(terminalId: string): PersistedCashSessionAggregate | null {
    const row = this.#db.prepare(
      `
        SELECT cash_session_id AS cashSessionId
        FROM cash_sessions
        WHERE terminal_id = :terminalId
          AND status <> 'FECHADO'
        ORDER BY opened_at DESC
        LIMIT 1
      `
    ).get({ terminalId }) as { cashSessionId: string } | undefined;

    return row ? this.findById(row.cashSessionId) : null;
  }

  findLatestByTerminalId(terminalId: string): PersistedCashSessionAggregate | null {
    const row = this.#db.prepare(
      `
        SELECT cash_session_id AS cashSessionId
        FROM cash_sessions
        WHERE terminal_id = :terminalId
        ORDER BY updated_at DESC, opened_at DESC, cash_session_id DESC
        LIMIT 1
      `
    ).get({ terminalId }) as { cashSessionId: string } | undefined;

    return row ? this.findById(row.cashSessionId) : null;
  }

  saveAggregate(input: SaveCashSessionAggregateInput): PersistedCashSessionAggregate {
    executeTransaction(this.#db, () => {
      this.#upsertSession(input.session);

      for (const movement of input.movements) {
        this.#upsertMovement(movement);
      }

      for (const event of input.auditEvents ?? []) {
        this.#appendAuditEvent(event);
      }
    });

    const persisted = this.findById(input.session.cashSessionId);

    if (!persisted) {
      throw new Error(`Sessao de caixa nao encontrada apos persistencia: ${input.session.cashSessionId}`);
    }

    return persisted;
  }

  exportAuditBundle(cashSessionId: string) {
    const aggregate = this.findById(cashSessionId);

    if (!aggregate) {
      throw new Error(`Sessao de caixa nao encontrada: ${cashSessionId}`);
    }

    const auditEvents = this.#db.prepare(
      `
        SELECT
          event_id AS eventId,
          entity,
          entity_id AS entityId,
          action,
          actor_user_id AS actorUserId,
          actor_terminal_id AS actorTerminalId,
          actor_role AS actorRole,
          occurred_at AS occurredAt,
          payload_json AS payloadJson,
          created_at AS createdAt
        FROM audit_events
        WHERE entity = 'CAIXA'
          AND entity_id = :cashSessionId
        ORDER BY occurred_at ASC, event_id ASC
      `
    ).all({ cashSessionId }) as Array<{
      eventId: string;
      entity: string;
      entityId: string;
      action: string;
      actorUserId: string | null;
      actorTerminalId: string | null;
      actorRole: string | null;
      occurredAt: string;
      payloadJson: string;
      createdAt: string;
    }>;

    return {
      session: aggregate.session,
      movements: aggregate.movements,
      auditEvents: auditEvents.map((event) => ({
        ...event,
        payload: parseJson(event.payloadJson)
      }))
    };
  }

  #upsertSession(session: SaveCashSessionAggregateInput["session"]): void {
    this.#db.prepare(
      `
        INSERT INTO cash_sessions (
          cash_session_id,
          terminal_id,
          opened_by_user_id,
          opened_by_terminal_id,
          opened_by_role,
          opened_at,
          opening_fund_amount_cents,
          opening_reason,
          status,
          closing_started_at,
          closed_at,
          closed_by_user_id,
          closed_by_terminal_id,
          closed_by_role,
          closure_note,
          divergence_reason,
          closure_summary_json
        )
        VALUES (
          :cashSessionId,
          :terminalId,
          :openedByUserId,
          :openedByTerminalId,
          :openedByRole,
          :openedAt,
          :openingFundAmountCents,
          :openingReason,
          :status,
          :closingStartedAt,
          :closedAt,
          :closedByUserId,
          :closedByTerminalId,
          :closedByRole,
          :closureNote,
          :divergenceReason,
          :closureSummaryJson
        )
        ON CONFLICT(cash_session_id) DO UPDATE SET
          terminal_id = excluded.terminal_id,
          opened_by_user_id = excluded.opened_by_user_id,
          opened_by_terminal_id = excluded.opened_by_terminal_id,
          opened_by_role = excluded.opened_by_role,
          opened_at = excluded.opened_at,
          opening_fund_amount_cents = excluded.opening_fund_amount_cents,
          opening_reason = excluded.opening_reason,
          status = excluded.status,
          closing_started_at = excluded.closing_started_at,
          closed_at = excluded.closed_at,
          closed_by_user_id = excluded.closed_by_user_id,
          closed_by_terminal_id = excluded.closed_by_terminal_id,
          closed_by_role = excluded.closed_by_role,
          closure_note = excluded.closure_note,
          divergence_reason = excluded.divergence_reason,
          closure_summary_json = excluded.closure_summary_json,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    ).run({
      cashSessionId: session.cashSessionId,
      terminalId: session.terminalId,
      openedByUserId: session.openedByUserId,
      openedByTerminalId: session.openedByTerminalId,
      openedByRole: session.openedByRole,
      openedAt: session.openedAt,
      openingFundAmountCents: session.openingFundAmountCents,
      openingReason: session.openingReason,
      status: session.status,
      closingStartedAt: session.closingStartedAt,
      closedAt: session.closedAt,
      closedByUserId: session.closedByUserId,
      closedByTerminalId: session.closedByTerminalId,
      closedByRole: session.closedByRole,
      closureNote: session.closureNote,
      divergenceReason: session.divergenceReason,
      closureSummaryJson: serializeJson(session.closureSummary)
    });
  }

  #upsertMovement(movement: SaveCashSessionAggregateInput["movements"][number]): void {
    this.#db.prepare(
      `
        INSERT INTO cash_movements (
          cash_movement_id,
          cash_session_id,
          movement_type,
          payment_method,
          amount_cents,
          reason,
          source_entity,
          source_entity_id,
          occurred_at,
          actor_user_id,
          actor_terminal_id,
          actor_role
        )
        VALUES (
          :cashMovementId,
          :cashSessionId,
          :movementType,
          :paymentMethod,
          :amountCents,
          :reason,
          :sourceEntity,
          :sourceEntityId,
          :occurredAt,
          :actorUserId,
          :actorTerminalId,
          :actorRole
        )
        ON CONFLICT(cash_movement_id) DO UPDATE SET
          movement_type = excluded.movement_type,
          payment_method = excluded.payment_method,
          amount_cents = excluded.amount_cents,
          reason = excluded.reason,
          source_entity = excluded.source_entity,
          source_entity_id = excluded.source_entity_id,
          occurred_at = excluded.occurred_at,
          actor_user_id = excluded.actor_user_id,
          actor_terminal_id = excluded.actor_terminal_id,
          actor_role = excluded.actor_role
      `
    ).run(movement);
  }

  #appendAuditEvent(event: AuditEventInput): void {
    this.#db.prepare(
      `
        INSERT INTO audit_events (
          event_id,
          entity,
          entity_id,
          action,
          actor_user_id,
          actor_terminal_id,
          actor_role,
          occurred_at,
          payload_json
        )
        VALUES (
          :eventId,
          :entity,
          :entityId,
          :action,
          :actorUserId,
          :actorTerminalId,
          :actorRole,
          :occurredAt,
          :payloadJson
        )
        ON CONFLICT(event_id) DO NOTHING
      `
    ).run({
      eventId: event.eventId,
      entity: event.entity,
      entityId: event.entityId,
      action: event.action,
      actorUserId: event.actorUserId ?? null,
      actorTerminalId: event.actorTerminalId ?? null,
      actorRole: event.actorRole ?? null,
      occurredAt: event.occurredAt,
      payloadJson: serializeJson(event.payload)
    });
  }
}

function mapCashSession(row: CashSessionRow): CashSessionRecord {
  return {
    cashSessionId: row.cashSessionId,
    terminalId: row.terminalId,
    openedByUserId: row.openedByUserId,
    openedByTerminalId: row.openedByTerminalId,
    openedByRole: row.openedByRole,
    openedAt: row.openedAt,
    openingFundAmountCents: row.openingFundAmountCents,
    openingReason: row.openingReason,
    status: row.status,
    closingStartedAt: row.closingStartedAt,
    closedAt: row.closedAt,
    closedByUserId: row.closedByUserId,
    closedByTerminalId: row.closedByTerminalId,
    closedByRole: row.closedByRole,
    closureNote: row.closureNote,
    divergenceReason: row.divergenceReason,
    closureSummary: parseJson(row.closureSummaryJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapCashMovement(row: CashMovementRow): CashMovementRecord {
  return {
    cashMovementId: row.cashMovementId,
    cashSessionId: row.cashSessionId,
    movementType: row.movementType,
    paymentMethod: row.paymentMethod,
    amountCents: row.amountCents,
    reason: row.reason,
    sourceEntity: row.sourceEntity,
    sourceEntityId: row.sourceEntityId,
    occurredAt: row.occurredAt,
    actorUserId: row.actorUserId,
    actorTerminalId: row.actorTerminalId,
    actorRole: row.actorRole,
    createdAt: row.createdAt
  };
}
