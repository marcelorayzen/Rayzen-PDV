export class CashDomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CashDomainError";
    this.code = code;
  }
}

export function assertCashInvariant(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) {
    throw new CashDomainError(code, message);
  }
}
