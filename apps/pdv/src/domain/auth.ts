export const OPERATOR_ROLES = [
  "CAIXA",
  "GARCOM",
  "GERENTE"
] as const;

export type OperatorRole = (typeof OPERATOR_ROLES)[number];

export interface OperatorIdentity {
  operatorId: string;
  operatorCode: string;
  displayLabel: string;
  role: OperatorRole;
  status: "ACTIVE";
}

export interface OperatorSession {
  operatorId: string;
  operatorCode: string;
  displayLabel: string;
  role: OperatorRole;
  authenticatedAt: string;
}

export interface AuthenticationFailure {
  code: "PIN_REQUIRED" | "PIN_INVALID" | "OPERATOR_UNAVAILABLE";
  message: string;
}

export interface AuthenticationSuccess {
  ok: true;
  session: OperatorSession;
}

export interface AuthenticationErrorResult {
  ok: false;
  failure: AuthenticationFailure;
}

export type AuthenticationResult = AuthenticationSuccess | AuthenticationErrorResult;

export function sanitizePinInput(value: string): string {
  return value.replace(/\D+/g, "").slice(0, 6);
}

export function isPinReady(pin: string): boolean {
  return sanitizePinInput(pin).length >= 4;
}

export function createOperatorSession(
  operator: OperatorIdentity,
  authenticatedAt: string
): OperatorSession {
  return {
    operatorId: operator.operatorId,
    operatorCode: operator.operatorCode,
    displayLabel: operator.displayLabel,
    role: operator.role,
    authenticatedAt
  };
}

export function describeRole(role: OperatorRole): string {
  switch (role) {
    case "CAIXA":
      return "Opera caixa, checkout e conferencias sensiveis.";
    case "GARCOM":
      return "Abre comandas, lanca itens e envia setores para producao.";
    case "GERENTE":
      return "Acompanha operacao, libera excecoes e cobre todo o shell.";
  }
}
