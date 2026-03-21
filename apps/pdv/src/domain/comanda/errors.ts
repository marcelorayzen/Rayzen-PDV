export class ComandaDomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ComandaDomainError";
    this.code = code;
  }
}

export function assertComandaInvariant(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) {
    throw new ComandaDomainError(code, message);
  }
}
