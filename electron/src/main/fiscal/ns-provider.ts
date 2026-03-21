import type { FiscalDocumentModel, FiscalEmissionMode, FiscalEnvironment, FiscalProvider, FiscalStateCode } from "@rayzen/db";

import type { FiscalSecretPayload } from "./secret-store.js";

export interface NsFiscalProviderIssueRequest {
  fiscalDocId: string;
  emitterId: string;
  terminalId: string;
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  stateCode: FiscalStateCode;
  documentModel: FiscalDocumentModel;
  serie: string;
  numero: number;
  payload: Record<string, unknown>;
  secrets: FiscalSecretPayload;
  issuedAt: string;
  accessKey?: string | null;
  emissionMode: FiscalEmissionMode;
  contingencyStartedAt?: string | null;
  contingencyJustification?: string | null;
}

export interface NsFiscalProviderQueryStatusRequest {
  emitterId: string;
  accessKey: string;
  provider: FiscalProvider;
  environment: FiscalEnvironment;
  stateCode: FiscalStateCode;
  documentModel: FiscalDocumentModel;
  secrets: FiscalSecretPayload;
  asOf: string;
}

export type NsFiscalProviderIssueResult =
  | {
      kind: "AUTHORIZED";
      nsReferenceId: string;
      accessKey: string;
      protocolNumber: string;
      authorizedAt: string;
      xmlContent: string;
    }
  | {
      kind: "PENDING";
      nsReferenceId: string;
      nextRetryAt: string;
      message: string;
    }
  | {
      kind: "REJECTED";
      code: string;
      message: string;
      retryable: boolean;
      nextRetryAt?: string | null;
    }
  | {
      kind: "CONTINGENCY_REQUIRED";
      code: string;
      message: string;
      accessKey: string;
      contingencyStartedAt: string;
      contingencyJustification: string;
      nextRetryAt: string;
    };

export type NsFiscalProviderQueryStatusResult =
  | {
      kind: "AUTHORIZED";
      nsReferenceId: string;
      accessKey: string;
      protocolNumber: string;
      authorizedAt: string;
      xmlContent: string;
    }
  | {
      kind: "PENDING";
      message: string;
      nextRetryAt: string;
    }
  | {
      kind: "REJECTED";
      code: string;
      message: string;
      retryable: boolean;
      nextRetryAt?: string | null;
    }
  | {
      kind: "NOT_FOUND";
      message: string;
      nextRetryAt: string;
    };

export interface NsFiscalProviderLike {
  issueNfce(request: NsFiscalProviderIssueRequest): Promise<NsFiscalProviderIssueResult>;
  queryStatusByAccessKey(
    request: NsFiscalProviderQueryStatusRequest
  ): Promise<NsFiscalProviderQueryStatusResult>;
}

export class NsTecnologiaFiscalProvider implements NsFiscalProviderLike {
  async issueNfce(request: NsFiscalProviderIssueRequest): Promise<NsFiscalProviderIssueResult> {
    void request.secrets;

    const accessKey = request.accessKey ?? buildNsAccessKey(request);
    const simulation = typeof request.payload["simulation"] === "string" ? request.payload["simulation"] : null;

    if (simulation === "timeout") {
      return {
        kind: "CONTINGENCY_REQUIRED",
        code: "NS_TIMEOUT",
        message: "Sem resposta do provider NS; operar em contingencia offline.",
        accessKey,
        contingencyStartedAt: request.contingencyStartedAt ?? request.issuedAt,
        contingencyJustification:
          request.contingencyJustification ?? "Sem retorno do provider NS durante a transmissao.",
        nextRetryAt: new Date(Date.parse(request.issuedAt) + 60_000).toISOString()
      };
    }

    if (simulation === "pending") {
      return {
        kind: "PENDING",
        nsReferenceId: `nsref_${request.fiscalDocId}`,
        nextRetryAt: new Date(Date.parse(request.issuedAt) + 60_000).toISOString(),
        message: "Documento recebido pelo provider e aguardando processamento."
      };
    }

    if (simulation === "rejected") {
      return {
        kind: "REJECTED",
        code: "539",
        message: "Duplicidade de NFC-e para numero informado.",
        retryable: false,
        nextRetryAt: null
      };
    }

    return {
      kind: "AUTHORIZED",
      nsReferenceId: `nsref_${request.fiscalDocId}`,
      accessKey,
      protocolNumber: `13526${request.numero.toString().padStart(9, "0")}`,
      authorizedAt: request.issuedAt,
      xmlContent: renderAuthorizedXml(request, accessKey)
    };
  }

  async queryStatusByAccessKey(
    request: NsFiscalProviderQueryStatusRequest
  ): Promise<NsFiscalProviderQueryStatusResult> {
    void request.secrets;

    return {
      kind: "NOT_FOUND",
      message: "Sem confirmacao remota disponivel para a chave consultada.",
      nextRetryAt: new Date(Date.parse(request.asOf) + 60_000).toISOString()
    };
  }
}

export function buildNsAccessKey(request: {
  emitterId: string;
  terminalId: string;
  stateCode: FiscalStateCode;
  documentModel: FiscalDocumentModel;
  serie: string;
  numero: number;
  emissionMode: FiscalEmissionMode;
}): string {
  const emitterDigits = request.emitterId.replace(/\D/g, "").padStart(14, "0").slice(-14);
  const terminalDigits = request.terminalId.replace(/\D/g, "").padStart(8, "0").slice(-8);
  const tpEmis = request.emissionMode === "CONTINGENCY_OFFLINE" ? "9" : "1";
  const raw = [
    request.stateCode,
    request.documentModel,
    tpEmis,
    request.serie.padStart(3, "0"),
    request.numero.toString().padStart(9, "0"),
    emitterDigits,
    terminalDigits
  ].join("");

  return raw.padEnd(44, "0").slice(0, 44);
}

function renderAuthorizedXml(request: NsFiscalProviderIssueRequest, accessKey: string): string {
  const tpEmis = request.emissionMode === "CONTINGENCY_OFFLINE" ? "9" : "1";

  return [
    "<RayzenNfce>",
    `  <Provider>${request.provider}</Provider>`,
    `  <Environment>${request.environment}</Environment>`,
    `  <EmitterId>${request.emitterId}</EmitterId>`,
    `  <FiscalDocId>${request.fiscalDocId}</FiscalDocId>`,
    `  <Serie>${request.serie}</Serie>`,
    `  <Numero>${request.numero}</Numero>`,
    `  <TpEmis>${tpEmis}</TpEmis>`,
    `  <AccessKey>${accessKey}</AccessKey>`,
    `  <IssuedAt>${request.issuedAt}</IssuedAt>`,
    request.contingencyStartedAt ? `  <DhCont>${request.contingencyStartedAt}</DhCont>` : null,
    request.contingencyJustification
      ? `  <XJust>${escapeXml(request.contingencyJustification)}</XJust>`
      : null,
    "</RayzenNfce>"
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
