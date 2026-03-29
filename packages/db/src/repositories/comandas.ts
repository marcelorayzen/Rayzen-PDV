import type { DatabaseSync } from "node:sqlite";

import { parseJson, serializeJson } from "../json.js";
import { executeTransaction } from "../transaction.js";
import type {
  AuditEventInput,
  ComandaItemRecord,
  ComandaPaymentRecord,
  ComandaPreContaRecord,
  ComandaRecord,
  PersistedComandaAggregate,
  SaveComandaAggregateInput
} from "../types.js";

interface ComandaRow {
  comandaId: string;
  numero: string;
  mesaId: string | null;
  atendimentoRef: string | null;
  status: ComandaRecord["status"];
  currentOwnerUserId: string | null;
  openedAt: string;
  closedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  subtotalAmountCents: number;
  paidAmountCents: number;
  changeAmountCents: number;
  productionBatchesJson: string;
  createdAt: string;
  updatedAt: string;
}

interface ComandaItemRow {
  itemId: string;
  comandaId: string;
  produtoId: string;
  productLabel: string;
  setor: string;
  quantity: number;
  unitPriceCents: number;
  status: ComandaItemRecord["status"];
  note: string | null;
  productionBatchId: string | null;
  createdAt: string;
  sentAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  updatedAt: string;
}

interface ComandaPaymentRow {
  paymentId: string;
  comandaId: string;
  method: string;
  amountCents: number;
  status: ComandaPaymentRecord["status"];
  confirmedAt: string;
  createdAt: string;
}

interface ComandaPreContaRow {
  preContaId: string;
  comandaId: string;
  version: number;
  totalAmountCents: number;
  snapshotJson: string;
  generatedAt: string;
  createdAt: string;
}

export class ComandaRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  findById(comandaId: string): PersistedComandaAggregate | null {
    const comandaRow = this.#db.prepare(
      `
        SELECT
          comanda_id AS comandaId,
          numero,
          mesa_id AS mesaId,
          atendimento_ref AS atendimentoRef,
          status,
          current_owner_user_id AS currentOwnerUserId,
          opened_at AS openedAt,
          closed_at AS closedAt,
          cancelled_at AS cancelledAt,
          cancellation_reason AS cancellationReason,
          subtotal_amount_cents AS subtotalAmountCents,
          paid_amount_cents AS paidAmountCents,
          change_amount_cents AS changeAmountCents,
          production_batches_json AS productionBatchesJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM comandas
        WHERE comanda_id = :comandaId
      `
    ).get({ comandaId }) as ComandaRow | undefined;

    if (!comandaRow) {
      return null;
    }

    const items = (this.#db.prepare(
      `
        SELECT
          item_id AS itemId,
          comanda_id AS comandaId,
          produto_id AS produtoId,
          product_label AS productLabel,
          setor,
          quantity,
          unit_price_cents AS unitPriceCents,
          status,
          note,
          production_batch_id AS productionBatchId,
          created_at AS createdAt,
          sent_at AS sentAt,
          cancelled_at AS cancelledAt,
          cancellation_reason AS cancellationReason,
          updated_at AS updatedAt
        FROM comanda_items
        WHERE comanda_id = :comandaId
        ORDER BY created_at ASC, item_id ASC
      `
    ).all({ comandaId }) as unknown as ComandaItemRow[]).map(mapComandaItem);

    const payments = (this.#db.prepare(
      `
        SELECT
          payment_id AS paymentId,
          comanda_id AS comandaId,
          method,
          amount_cents AS amountCents,
          status,
          confirmed_at AS confirmedAt,
          created_at AS createdAt
        FROM comanda_payments
        WHERE comanda_id = :comandaId
        ORDER BY confirmed_at ASC, payment_id ASC
      `
    ).all({ comandaId }) as unknown as ComandaPaymentRow[]).map(mapComandaPayment);

    const preContas = (this.#db.prepare(
      `
        SELECT
          pre_conta_id AS preContaId,
          comanda_id AS comandaId,
          version,
          total_amount_cents AS totalAmountCents,
          snapshot_json AS snapshotJson,
          generated_at AS generatedAt,
          created_at AS createdAt
        FROM comanda_precontas
        WHERE comanda_id = :comandaId
        ORDER BY version ASC
      `
    ).all({ comandaId }) as unknown as ComandaPreContaRow[]).map(mapComandaPreConta);

    return {
      comanda: mapComanda(comandaRow),
      items,
      payments,
      preContas
    };
  }

  findLatestActive(): PersistedComandaAggregate | null {
    const row = this.#db.prepare(
      `
        SELECT comanda_id AS comandaId
        FROM comandas
        WHERE status NOT IN ('ENCERRADA', 'CANCELADA')
        ORDER BY updated_at DESC, opened_at DESC, comanda_id DESC
        LIMIT 1
      `
    ).get() as { comandaId: string } | undefined;

    return row ? this.findById(row.comandaId) : null;
  }

  listActive(): PersistedComandaAggregate[] {
    const rows = this.#db.prepare(
      `
        SELECT comanda_id AS comandaId
        FROM comandas
        WHERE status NOT IN ('ENCERRADA', 'CANCELADA')
        ORDER BY updated_at DESC, opened_at DESC, comanda_id DESC
      `
    ).all() as { comandaId: string }[];

    return rows
      .map((row) => this.findById(row.comandaId))
      .filter((aggregate): aggregate is PersistedComandaAggregate => aggregate !== null);
  }

  findLatestActiveByNumero(numero: string): PersistedComandaAggregate | null {
    const row = this.#db.prepare(
      `
        SELECT comanda_id AS comandaId
        FROM comandas
        WHERE numero = :numero
          AND status NOT IN ('ENCERRADA', 'CANCELADA')
        ORDER BY updated_at DESC, opened_at DESC, comanda_id DESC
        LIMIT 1
      `
    ).get({ numero }) as { comandaId: string } | undefined;

    return row ? this.findById(row.comandaId) : null;
  }

  countByStatus(status: ComandaRecord["status"]): number {
    const row = this.#db.prepare(
      `
        SELECT COUNT(1) AS total
        FROM comandas
        WHERE status = :status
      `
    ).get({ status }) as { total: number };

    return row.total;
  }

  saveAggregate(input: SaveComandaAggregateInput): PersistedComandaAggregate {
    executeTransaction(this.#db, () => {
      this.#upsertComanda(input);

      for (const item of input.items) {
        this.#upsertItem(item);
      }

      for (const payment of input.payments) {
        this.#upsertPayment(payment);
      }

      for (const preConta of input.preContas) {
        this.#upsertPreConta(preConta);
      }

      for (const event of input.auditEvents ?? []) {
        this.#appendAuditEvent(event);
      }
    });

    const persisted = this.findById(input.comanda.comandaId);

    if (!persisted) {
      throw new Error(`Comanda nao encontrada apos persistencia: ${input.comanda.comandaId}`);
    }

    return persisted;
  }

  #upsertComanda(input: SaveComandaAggregateInput): void {
    this.#db.prepare(
      `
        INSERT INTO comandas (
          comanda_id,
          numero,
          mesa_id,
          atendimento_ref,
          status,
          current_owner_user_id,
          opened_at,
          closed_at,
          cancelled_at,
          cancellation_reason,
          subtotal_amount_cents,
          paid_amount_cents,
          change_amount_cents,
          production_batches_json
        )
        VALUES (
          :comandaId,
          :numero,
          :mesaId,
          :atendimentoRef,
          :status,
          :currentOwnerUserId,
          :openedAt,
          :closedAt,
          :cancelledAt,
          :cancellationReason,
          :subtotalAmountCents,
          :paidAmountCents,
          :changeAmountCents,
          :productionBatchesJson
        )
        ON CONFLICT(comanda_id) DO UPDATE SET
          numero = excluded.numero,
          mesa_id = excluded.mesa_id,
          atendimento_ref = excluded.atendimento_ref,
          status = excluded.status,
          current_owner_user_id = excluded.current_owner_user_id,
          opened_at = excluded.opened_at,
          closed_at = excluded.closed_at,
          cancelled_at = excluded.cancelled_at,
          cancellation_reason = excluded.cancellation_reason,
          subtotal_amount_cents = excluded.subtotal_amount_cents,
          paid_amount_cents = excluded.paid_amount_cents,
          change_amount_cents = excluded.change_amount_cents,
          production_batches_json = excluded.production_batches_json,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    ).run({
      comandaId: input.comanda.comandaId,
      numero: input.comanda.numero,
      mesaId: input.comanda.mesaId,
      atendimentoRef: input.comanda.atendimentoRef,
      status: input.comanda.status,
      currentOwnerUserId: input.comanda.currentOwnerUserId,
      openedAt: input.comanda.openedAt,
      closedAt: input.comanda.closedAt,
      cancelledAt: input.comanda.cancelledAt,
      cancellationReason: input.comanda.cancellationReason,
      subtotalAmountCents: input.comanda.subtotalAmountCents,
      paidAmountCents: input.comanda.paidAmountCents,
      changeAmountCents: input.comanda.changeAmountCents,
      productionBatchesJson: serializeJson(input.comanda.productionBatches)
    });
  }

  #upsertItem(item: SaveComandaAggregateInput["items"][number]): void {
    this.#db.prepare(
      `
        INSERT INTO comanda_items (
          item_id,
          comanda_id,
          produto_id,
          product_label,
          setor,
          quantity,
          unit_price_cents,
          status,
          note,
          production_batch_id,
          created_at,
          sent_at,
          cancelled_at,
          cancellation_reason
        )
        VALUES (
          :itemId,
          :comandaId,
          :produtoId,
          :productLabel,
          :setor,
          :quantity,
          :unitPriceCents,
          :status,
          :note,
          :productionBatchId,
          :createdAt,
          :sentAt,
          :cancelledAt,
          :cancellationReason
        )
        ON CONFLICT(item_id) DO UPDATE SET
          produto_id = excluded.produto_id,
          product_label = excluded.product_label,
          setor = excluded.setor,
          quantity = excluded.quantity,
          unit_price_cents = excluded.unit_price_cents,
          status = excluded.status,
          note = excluded.note,
          production_batch_id = excluded.production_batch_id,
          sent_at = excluded.sent_at,
          cancelled_at = excluded.cancelled_at,
          cancellation_reason = excluded.cancellation_reason,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    ).run(item);
  }

  #upsertPayment(payment: SaveComandaAggregateInput["payments"][number]): void {
    this.#db.prepare(
      `
        INSERT INTO comanda_payments (
          payment_id,
          comanda_id,
          method,
          amount_cents,
          status,
          confirmed_at
        )
        VALUES (
          :paymentId,
          :comandaId,
          :method,
          :amountCents,
          :status,
          :confirmedAt
        )
        ON CONFLICT(payment_id) DO UPDATE SET
          method = excluded.method,
          amount_cents = excluded.amount_cents,
          status = excluded.status,
          confirmed_at = excluded.confirmed_at
      `
    ).run(payment);
  }

  #upsertPreConta(preConta: SaveComandaAggregateInput["preContas"][number]): void {
    this.#db.prepare(
      `
        INSERT INTO comanda_precontas (
          pre_conta_id,
          comanda_id,
          version,
          total_amount_cents,
          snapshot_json,
          generated_at
        )
        VALUES (
          :preContaId,
          :comandaId,
          :version,
          :totalAmountCents,
          :snapshotJson,
          :generatedAt
        )
        ON CONFLICT(pre_conta_id) DO UPDATE SET
          version = excluded.version,
          total_amount_cents = excluded.total_amount_cents,
          snapshot_json = excluded.snapshot_json,
          generated_at = excluded.generated_at
      `
    ).run({
      preContaId: preConta.preContaId,
      comandaId: preConta.comandaId,
      version: preConta.version,
      totalAmountCents: preConta.totalAmountCents,
      snapshotJson: serializeJson(preConta.snapshot),
      generatedAt: preConta.generatedAt
    });
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

function mapComanda(row: ComandaRow): ComandaRecord {
  return {
    comandaId: row.comandaId,
    numero: row.numero,
    mesaId: row.mesaId,
    atendimentoRef: row.atendimentoRef,
    status: row.status,
    currentOwnerUserId: row.currentOwnerUserId,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    subtotalAmountCents: row.subtotalAmountCents,
    paidAmountCents: row.paidAmountCents,
    changeAmountCents: row.changeAmountCents,
    productionBatches: parseJson(row.productionBatchesJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapComandaItem(row: ComandaItemRow): ComandaItemRecord {
  return {
    itemId: row.itemId,
    comandaId: row.comandaId,
    produtoId: row.produtoId,
    productLabel: row.productLabel,
    setor: row.setor,
    quantity: row.quantity,
    unitPriceCents: row.unitPriceCents,
    status: row.status,
    note: row.note,
    productionBatchId: row.productionBatchId,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    updatedAt: row.updatedAt
  };
}

function mapComandaPayment(row: ComandaPaymentRow): ComandaPaymentRecord {
  return {
    paymentId: row.paymentId,
    comandaId: row.comandaId,
    method: row.method,
    amountCents: row.amountCents,
    status: row.status,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt
  };
}

function mapComandaPreConta(row: ComandaPreContaRow): ComandaPreContaRecord {
  return {
    preContaId: row.preContaId,
    comandaId: row.comandaId,
    version: row.version,
    totalAmountCents: row.totalAmountCents,
    snapshot: parseJson(row.snapshotJson),
    generatedAt: row.generatedAt,
    createdAt: row.createdAt
  };
}
