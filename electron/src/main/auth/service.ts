import type { RayzenDatabaseClient } from "@rayzen/db";
import { hashPin } from "@rayzen/db";
import {
  createOperatorSession,
  sanitizePinInput,
  type AuthenticationResult,
  type OperatorSession
} from "@rayzen/pdv";

import type {
  AuthLoginRequest,
  AuthLogoutRequest,
  AuthSessionSnapshot
} from "../../contracts/ipc.js";
import type { MainProcessLogStore } from "../log-store.js";

export interface OperatorAuthServiceOptions {
  defaultTerminalId?: string;
}

export class OperatorAuthService {
  readonly #database: RayzenDatabaseClient;
  readonly #logger: MainProcessLogStore;
  readonly #defaultTerminalId: string;

  constructor(
    database: RayzenDatabaseClient,
    logger: MainProcessLogStore,
    options: OperatorAuthServiceOptions = {}
  ) {
    this.#database = database;
    this.#logger = logger;
    this.#defaultTerminalId = options.defaultTerminalId ?? "pdv-main";
  }

  login(request: AuthLoginRequest): AuthenticationResult {
    const terminalId = request.terminalId ?? this.#defaultTerminalId;
    const pin = sanitizePinInput(request.pin);

    if (!pin) {
      return {
        ok: false,
        failure: {
          code: "PIN_REQUIRED",
          message: "Informe um PIN local valido."
        }
      };
    }

    const operator = this.#database.operators.findActiveByPinHash(hashPin(pin));

    if (!operator) {
      this.#database.auditEvents.append({
        eventId: `evt_auth_fail_${Date.now()}`,
        entity: "OPERATOR_SESSION",
        entityId: terminalId,
        action: "AUTH_LOGIN_FAILED",
        actorTerminalId: terminalId,
        occurredAt: new Date().toISOString(),
        payload: {
          reasonCode: "PIN_INVALID"
        }
      });
      this.#logger.warn("electron.auth.login-failed", {
        terminalId,
        reasonCode: "PIN_INVALID"
      });

      return {
        ok: false,
        failure: {
          code: "PIN_INVALID",
          message: "PIN local invalido. Tente novamente."
        }
      };
    }

    const loginAt = new Date().toISOString();
    this.#database.operators.upsertSession({
      terminalId,
      operatorId: operator.operatorId,
      loginAt
    });
    this.#database.auditEvents.append({
      eventId: `evt_auth_login_${Date.now()}`,
      entity: "OPERATOR_SESSION",
      entityId: terminalId,
      action: "AUTH_LOGIN_SUCCEEDED",
      actorUserId: operator.operatorId,
      actorTerminalId: terminalId,
      actorRole: operator.role,
      occurredAt: loginAt,
      payload: {
        operatorCode: operator.operatorCode
      }
    });

    const session = createOperatorSession({
      operatorId: operator.operatorId,
      operatorCode: operator.operatorCode,
      displayLabel: operator.nome,
      role: operator.role,
      status: "ACTIVE"
    }, loginAt);

    this.#logger.info("electron.auth.login-succeeded", {
      terminalId,
      operatorId: operator.operatorId,
      role: operator.role
    });

    return {
      ok: true,
      session
    };
  }

  logout(request: AuthLogoutRequest = {}): void {
    const terminalId = request.terminalId ?? this.#defaultTerminalId;
    const persisted = this.#database.operators.findSessionByTerminalId(terminalId);

    this.#database.operators.clearSession(terminalId);

    this.#database.auditEvents.append({
      eventId: `evt_auth_logout_${Date.now()}`,
      entity: "OPERATOR_SESSION",
      entityId: terminalId,
      action: "AUTH_LOGOUT",
      actorUserId: persisted?.operator.operatorId ?? null,
      actorTerminalId: terminalId,
      actorRole: persisted?.operator.role ?? null,
      occurredAt: new Date().toISOString(),
      payload: {
        hadSession: Boolean(persisted)
      }
    });
  }

  getSession(terminalId = this.#defaultTerminalId): AuthSessionSnapshot | null {
    const persisted = this.#database.operators.findSessionByTerminalId(terminalId);

    if (!persisted) {
      return null;
    }

    return createOperatorSession({
      operatorId: persisted.operator.operatorId,
      operatorCode: persisted.operator.operatorCode,
      displayLabel: persisted.operator.nome,
      role: persisted.operator.role,
      status: "ACTIVE"
    }, persisted.session.loginAt) as OperatorSession;
  }
}
