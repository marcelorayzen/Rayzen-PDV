import { randomUUID } from "node:crypto";

export interface WaiterSession {
  sessionId: string;
  operatorId: string;
  operatorCode: string;
  displayLabel: string;
  role: string;
  createdAt: number;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

export class WaiterSessionStore {
  readonly #sessions = new Map<string, WaiterSession>();

  create(operator: Omit<WaiterSession, "sessionId" | "createdAt">): WaiterSession {
    const session: WaiterSession = {
      ...operator,
      sessionId: randomUUID(),
      createdAt: Date.now()
    };
    this.#sessions.set(session.sessionId, session);
    return session;
  }

  get(sessionId: string): WaiterSession | null {
    const session = this.#sessions.get(sessionId);
    if (!session) return null;
    if (Date.now() - session.createdAt > SESSION_TTL_MS) {
      this.#sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  delete(sessionId: string): void {
    this.#sessions.delete(sessionId);
  }
}
