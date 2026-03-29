import { assertComandaInvariant } from "./errors.js";
import type {
  AddComandaItemInput,
  CancelComandaInput,
  CancelComandaItemInput,
  CheckoutComandaInput,
  CheckoutPaymentInput,
  ComandaAggregate,
  ComandaAuditEvent,
  ComandaItem,
  ComandaMutationResult,
  ComandaPayment,
  ComandaTotals,
  GeneratePreContaInput,
  OpenComandaInput,
  PreContaSnapshot,
  PreContaSnapshotItem,
  ProductionBatch,
  ReopenComandaInput,
  RequestComandaCashCheckoutInput,
  SendToProductionInput
} from "./types.js";

export function openComanda(input: OpenComandaInput): ComandaMutationResult {
  assertComandaInvariant(input.comandaId.trim().length > 0, "COMANDA_ID_INVALIDO", "comandaId e obrigatorio.");
  assertComandaInvariant(input.numero.trim().length > 0, "COMANDA_NUMERO_INVALIDO", "numero e obrigatorio.");

  const comanda: ComandaAggregate = {
    comandaId: input.comandaId,
    numero: input.numero.trim(),
    mesaId: normalizeNullable(input.mesaId),
    atendimentoRef: normalizeNullable(input.atendimentoRef),
    cashCheckoutRequestedAt: null,
    status: "ABERTA",
    openedAt: input.openedAt,
    currentOwnerUserId: normalizeNullable(input.currentOwnerUserId),
    cancelledAt: null,
    cancellationReason: null,
    closedAt: null,
    items: [],
    payments: [],
    preContas: [],
    productionBatches: []
  };

  return {
    comanda,
    auditEvents: [
      createAuditEvent({
        eventId: input.auditEventId,
        entity: "COMANDA",
        entityId: input.comandaId,
        action: "COMANDA_ABERTA",
        actor: input.actor,
        at: input.openedAt,
        payload: {
          numero: comanda.numero,
          mesaId: comanda.mesaId,
          atendimentoRef: comanda.atendimentoRef
        }
      })
    ]
  };
}

export function addComandaItem(
  comanda: ComandaAggregate,
  input: AddComandaItemInput
): ComandaMutationResult {
  assertComandaEditable(comanda);
  assertComandaInvariant(
    input.quantity > 0 && Number.isFinite(input.quantity),
    "ITEM_QTD_INVALIDA",
    "quantity deve ser maior que zero."
  );
  assertComandaInvariant(
    Number.isInteger(input.unitPriceCents) && input.unitPriceCents >= 0,
    "ITEM_PRECO_INVALIDO",
    "unitPriceCents deve ser inteiro maior ou igual a zero."
  );
  assertComandaInvariant(input.itemId.trim().length > 0, "ITEM_ID_INVALIDO", "itemId e obrigatorio.");
  assertComandaInvariant(input.produtoId.trim().length > 0, "ITEM_PRODUTO_INVALIDO", "produtoId e obrigatorio.");
  assertComandaInvariant(input.productLabel.trim().length > 0, "ITEM_LABEL_INVALIDA", "productLabel e obrigatorio.");
  assertComandaInvariant(input.setor.trim().length > 0, "ITEM_SETOR_INVALIDO", "setor e obrigatorio.");

  const item: ComandaItem = {
    itemId: input.itemId,
    produtoId: input.produtoId.trim(),
    productLabel: input.productLabel.trim(),
    setor: input.setor.trim(),
    quantity: input.quantity,
    unitPriceCents: input.unitPriceCents,
    status: "LANCADO",
    note: normalizeNullable(input.note),
    createdAt: input.occurredAt,
    sentAt: null,
    cancelledAt: null,
    cancellationReason: null,
    productionBatchId: null
  };

  const nextComanda = {
    ...comanda,
    items: [...comanda.items, item]
  };

  return {
    comanda: nextComanda,
    auditEvents: [
      createAuditEvent({
        eventId: input.auditEventId,
        entity: "ITEM",
        entityId: item.itemId,
        action: "ITEM_ADICIONADO",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          comandaId: comanda.comandaId,
          produtoId: item.produtoId,
          productLabel: item.productLabel,
          setor: item.setor,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          note: item.note
        }
      })
    ]
  };
}

export function cancelComandaItem(
  comanda: ComandaAggregate,
  input: CancelComandaItemInput
): ComandaMutationResult {
  assertComandaInvariant(
    comanda.status === "ABERTA" || comanda.status === "EM_PRODUCAO",
    "ITEM_CANCELAMENTO_INVALIDO",
    "Itens so podem ser cancelados quando a comanda estiver ABERTA ou EM_PRODUCAO."
  );

  const itemIndex = comanda.items.findIndex((item) => item.itemId === input.itemId);

  assertComandaInvariant(itemIndex >= 0, "ITEM_NAO_ENCONTRADO", "Item nao encontrado na comanda.");

  const currentItem = comanda.items[itemIndex];

  assertComandaInvariant(currentItem !== undefined, "ITEM_NAO_ENCONTRADO", "Item nao encontrado na comanda.");
  assertComandaInvariant(currentItem.status !== "CANCELADO", "ITEM_JA_CANCELADO", "Item ja esta cancelado.");

  const reason = requireReason(input.reason, "ITEM_CANCELAMENTO_SEM_MOTIVO");
  const updatedItem: ComandaItem = {
    ...currentItem,
    status: "CANCELADO",
    cancelledAt: input.occurredAt,
    cancellationReason: reason
  };
  const nextItems = [...comanda.items];
  nextItems[itemIndex] = updatedItem;

  return {
    comanda: {
      ...comanda,
      items: nextItems
    },
    auditEvents: [
      createAuditEvent({
        eventId: input.auditEventId,
        entity: "ITEM",
        entityId: currentItem.itemId,
        action: "ITEM_CANCELADO",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          comandaId: comanda.comandaId,
          previousStatus: currentItem.status,
          reason
        }
      })
    ]
  };
}

export function sendComandaToProduction(
  comanda: ComandaAggregate,
  input: SendToProductionInput
): ComandaMutationResult {
  assertComandaInvariant(
    comanda.status === "ABERTA" || comanda.status === "EM_PRODUCAO",
    "COMANDA_ENVIO_INVALIDO",
    "Somente comandas ABERTAS ou EM_PRODUCAO podem enviar itens para producao."
  );

  const existingBatch = comanda.productionBatches.find((batch) => batch.batchId === input.batchId);

  if (existingBatch) {
    return {
      comanda,
      auditEvents: [],
      productionBatch: existingBatch
    };
  }

  const pendingItems = comanda.items.filter((item) => item.status === "LANCADO");

  assertComandaInvariant(
    pendingItems.length > 0,
    "COMANDA_SEM_ITENS_PENDENTES",
    "Nao ha itens lancados pendentes para enviar."
  );

  const nextItems = comanda.items.map((item) => {
    if (item.status !== "LANCADO") {
      return item;
    }

    return {
      ...item,
      status: "ENVIADO" as const,
      sentAt: input.occurredAt,
      productionBatchId: input.batchId
    };
  });
  const productionBatch: ProductionBatch = {
    batchId: input.batchId,
    sentAt: input.occurredAt,
    setores: [...new Set(pendingItems.map((item) => item.setor))],
    sentItemIds: pendingItems.map((item) => item.itemId)
  };

  return {
    comanda: {
      ...comanda,
      status: "EM_PRODUCAO",
      items: nextItems,
      productionBatches: [...comanda.productionBatches, productionBatch]
    },
    auditEvents: [
      createAuditEvent({
        eventId: input.auditEventId,
        entity: "COMANDA",
        entityId: comanda.comandaId,
        action: "ENVIADO_PRODUCAO",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          batchId: productionBatch.batchId,
          setores: productionBatch.setores,
          sentItemIds: productionBatch.sentItemIds
        }
      })
    ],
    productionBatch
  };
}

export function generateComandaPreConta(
  comanda: ComandaAggregate,
  input: GeneratePreContaInput
): ComandaMutationResult {
  assertComandaInvariant(
    comanda.status === "EM_PRODUCAO",
    "PRE_CONTA_TRANSICAO_INVALIDA",
    "A pre-conta exige comanda em EM_PRODUCAO."
  );

  const totals = calculateComandaTotals(comanda);

  assertComandaInvariant(
    totals.activeItemCount > 0,
    "PRE_CONTA_SEM_ITENS",
    "A pre-conta exige pelo menos um item ativo."
  );

  const preContaSnapshot = createPreContaSnapshot(comanda, input.preContaId, input.occurredAt);

  return {
    comanda: {
      ...comanda,
      cashCheckoutRequestedAt: null,
      status: "EM_PAGAMENTO",
      preContas: [...comanda.preContas, preContaSnapshot]
    },
    auditEvents: [
      createAuditEvent({
        eventId: input.auditEventId,
        entity: "COMANDA",
        entityId: comanda.comandaId,
        action: "PRE_CONTA_GERADA",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          preContaId: preContaSnapshot.preContaId,
          version: preContaSnapshot.version,
          totalAmountCents: preContaSnapshot.totalAmountCents
        }
      })
    ],
    preContaSnapshot
  };
}

export function requestComandaCashCheckout(
  comanda: ComandaAggregate,
  input: RequestComandaCashCheckoutInput
): ComandaMutationResult {
  assertComandaInvariant(
    comanda.status === "EM_PAGAMENTO",
    "CAIXA_FILA_TRANSICAO_INVALIDA",
    "Encaminhar ao caixa exige comanda em EM_PAGAMENTO."
  );

  return {
    comanda: {
      ...comanda,
      cashCheckoutRequestedAt: input.occurredAt
    },
    auditEvents: [
      createAuditEvent({
        eventId: input.auditEventId,
        entity: "COMANDA",
        entityId: comanda.comandaId,
        action: "COMANDA_ENCAMINHADA_CAIXA",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          numero: comanda.numero,
          mesaId: comanda.mesaId
        }
      })
    ]
  };
}

export function checkoutComanda(
  comanda: ComandaAggregate,
  input: CheckoutComandaInput
): ComandaMutationResult {
  assertComandaInvariant(
    comanda.status === "EM_PAGAMENTO",
    "CHECKOUT_TRANSICAO_INVALIDA",
    "Checkout exige comanda em EM_PAGAMENTO."
  );
  assertComandaInvariant(input.payments.length > 0, "CHECKOUT_SEM_PAGAMENTO", "Checkout exige pelo menos um pagamento.");

  const totalsBefore = calculateComandaTotals(comanda);

  assertComandaInvariant(totalsBefore.activeItemCount > 0, "CHECKOUT_SEM_ITENS", "Checkout exige itens ativos.");

  const payments = input.payments.map((payment) => createPayment(payment, input.occurredAt));
  const paidAmountCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);

  assertComandaInvariant(
    paidAmountCents >= totalsBefore.itemSubtotalCents,
    "CHECKOUT_PAGAMENTO_INSUFICIENTE",
    "O total pago deve cobrir o total devido."
  );

  const changeAmountCents = paidAmountCents - totalsBefore.itemSubtotalCents;
  const cashAmountCents = payments
    .filter((payment) => payment.method === "DINHEIRO")
    .reduce((sum, payment) => sum + payment.amountCents, 0);

  assertComandaInvariant(
    changeAmountCents === 0 || cashAmountCents >= changeAmountCents,
    "CHECKOUT_TROCO_INVALIDO",
    "Troco controlado so pode existir quando houver pagamento em dinheiro suficiente."
  );

  const nextComanda = {
    ...comanda,
    cashCheckoutRequestedAt: null,
    status: "ENCERRADA" as const,
    closedAt: input.occurredAt,
    payments: [...comanda.payments, ...payments]
  };

  return {
    comanda: nextComanda,
    auditEvents: [
      createAuditEvent({
        eventId: input.auditEventId,
        entity: "COMANDA",
        entityId: comanda.comandaId,
        action: "CHECKOUT_CONCLUIDO",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          paidAmountCents,
          totalAmountCents: totalsBefore.itemSubtotalCents,
          changeAmountCents,
          payments: payments.map((payment) => {
            return {
              paymentId: payment.paymentId,
              method: payment.method,
              amountCents: payment.amountCents
            };
          })
        }
      })
    ]
  };
}

export function reopenComanda(
  comanda: ComandaAggregate,
  input: ReopenComandaInput
): ComandaMutationResult {
  assertComandaInvariant(
    comanda.status === "EM_PAGAMENTO",
    "COMANDA_REABERTURA_INVALIDA",
    "Somente comandas EM_PAGAMENTO podem ser reabertas."
  );

  return {
    comanda: {
      ...comanda,
      cashCheckoutRequestedAt: null,
      status: "EM_PRODUCAO"
    },
    auditEvents: [
      createAuditEvent({
        eventId: input.auditEventId,
        entity: "COMANDA",
        entityId: comanda.comandaId,
        action: "COMANDA_REABERTA",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          numero: comanda.numero,
          previousPreContaCount: comanda.preContas.length
        }
      })
    ]
  };
}

export function cancelComanda(
  comanda: ComandaAggregate,
  input: CancelComandaInput
): ComandaMutationResult {
  assertComandaInvariant(
    comanda.status !== "ENCERRADA" && comanda.status !== "CANCELADA",
    "COMANDA_CANCELAMENTO_INVALIDO",
    "Comandas finais nao podem ser canceladas."
  );
  assertComandaInvariant(
    comanda.payments.length === 0,
    "COMANDA_CANCELAMENTO_COM_PAGAMENTO",
    "Nao e permitido cancelar comanda com pagamento confirmado nesta chamada."
  );

  const reason = requireReason(input.reason, "COMANDA_CANCELAMENTO_SEM_MOTIVO");

  return {
    comanda: {
      ...comanda,
      cashCheckoutRequestedAt: null,
      status: "CANCELADA",
      cancelledAt: input.occurredAt,
      cancellationReason: reason,
      closedAt: comanda.closedAt ?? input.occurredAt
    },
    auditEvents: [
      createAuditEvent({
        eventId: input.auditEventId,
        entity: "COMANDA",
        entityId: comanda.comandaId,
        action: "COMANDA_CANCELADA",
        actor: input.actor,
        at: input.occurredAt,
        payload: {
          reason,
          previousStatus: comanda.status
        }
      })
    ]
  };
}

export function calculateComandaTotals(comanda: ComandaAggregate): ComandaTotals {
  const activeItems = comanda.items.filter((item) => item.status !== "CANCELADO");
  const itemSubtotalCents = activeItems.reduce((sum, item) => {
    return sum + Math.round(item.quantity * item.unitPriceCents);
  }, 0);
  const paidAmountCents = comanda.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const changeAmountCents = Math.max(0, paidAmountCents - itemSubtotalCents);

  return {
    itemSubtotalCents,
    paidAmountCents,
    dueAmountCents: Math.max(0, itemSubtotalCents - paidAmountCents),
    changeAmountCents,
    activeItemCount: activeItems.length,
    launchedItemCount: comanda.items.filter((item) => item.status === "LANCADO").length,
    sentItemCount: comanda.items.filter((item) => item.status === "ENVIADO").length,
    cancelledItemCount: comanda.items.filter((item) => item.status === "CANCELADO").length
  };
}

function createPreContaSnapshot(
  comanda: ComandaAggregate,
  preContaId: string,
  generatedAt: string
): PreContaSnapshot {
  const items = comanda.items
    .filter((item) => item.status !== "CANCELADO")
    .map<PreContaSnapshotItem>((item) => {
      return {
        itemId: item.itemId,
        produtoId: item.produtoId,
        productLabel: item.productLabel,
        setor: item.setor,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: Math.round(item.quantity * item.unitPriceCents),
        note: item.note
      };
    });
  const totalAmountCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);

  return {
    preContaId,
    version: comanda.preContas.length + 1,
    generatedAt,
    totalAmountCents,
    itemCount: items.length,
    items
  };
}

function createPayment(payment: CheckoutPaymentInput, confirmedAt: string): ComandaPayment {
  assertComandaInvariant(payment.paymentId.trim().length > 0, "PAGAMENTO_ID_INVALIDO", "paymentId e obrigatorio.");
  assertComandaInvariant(
    Number.isInteger(payment.amountCents) && payment.amountCents > 0,
    "PAGAMENTO_VALOR_INVALIDO",
    "amountCents deve ser inteiro maior que zero."
  );

  return {
    paymentId: payment.paymentId,
    method: payment.method,
    amountCents: payment.amountCents,
    status: "CONFIRMADO",
    confirmedAt
  };
}

function assertComandaEditable(comanda: ComandaAggregate): void {
  assertComandaInvariant(
    comanda.status === "ABERTA" || comanda.status === "EM_PRODUCAO",
    "COMANDA_NAO_EDITAVEL",
    "A comanda nao aceita novos itens neste estado."
  );
}

function createAuditEvent(event: ComandaAuditEvent): ComandaAuditEvent {
  return event;
}

function requireReason(reason: string, code: string): string {
  const normalized = reason.trim();

  assertComandaInvariant(normalized.length > 0, code, "Motivo obrigatorio.");
  return normalized;
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
