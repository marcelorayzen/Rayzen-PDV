export interface TicketActorPayload {
  userId: string;
  terminalId: string;
  role: string;
}

export interface TicketItemPayload {
  itemId: string;
  productLabel: string;
  quantity: number;
  note: string | null;
}

export interface TicketHeaderPayload {
  kind: "PRODUCAO" | "SEGUNDA_VIA";
  printJobId: string;
  batchId: string;
  setor: string;
  comandaNumero: string;
  mesaId: string | null;
  requestedAt: string;
  actor: TicketActorPayload;
  secondCopySequence?: number;
}

export interface TicketPayload {
  header: TicketHeaderPayload;
  items: TicketItemPayload[];
}

export function isTicketPayload(value: unknown): value is TicketPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as {
    header?: Record<string, unknown>;
    items?: unknown[];
  };

  return Boolean(candidate.header && Array.isArray(candidate.items));
}

export function renderKitchenTicket(payload: TicketPayload): string {
  const header = payload.header;
  const lines = [
    "RAYZEN PDV",
    header.kind === "SEGUNDA_VIA" ? "TICKET DE PRODUCAO - SEGUNDA VIA" : "TICKET DE PRODUCAO",
    `Setor: ${header.setor}`,
    `Comanda: ${header.comandaNumero}`,
    `Mesa: ${header.mesaId ?? "SEM MESA"}`,
    `Lote: ${header.batchId}`,
    `Operador: ${header.actor.userId} (${header.actor.role})`,
    `Solicitado em: ${header.requestedAt}`,
    ""
  ];

  for (const item of payload.items) {
    lines.push(`${formatQuantity(item.quantity)} ${item.productLabel}`);

    if (item.note) {
      lines.push(`Obs: ${item.note}`);
    }
  }

  lines.push("");
  lines.push(`Job: ${header.printJobId}`);

  if (header.kind === "SEGUNDA_VIA") {
    lines.push(`Marcacao: SEGUNDA VIA ${header.secondCopySequence ?? 1}`);
  }

  return `${lines.join("\n")}\n`;
}

function formatQuantity(quantity: number): string {
  const normalized = Number.isInteger(quantity) ? quantity.toFixed(0) : quantity.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${normalized}x`;
}
