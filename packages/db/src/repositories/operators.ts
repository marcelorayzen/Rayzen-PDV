import type { DatabaseSync } from "node:sqlite";

import type {
  OperatorRecord,
  OperatorSessionInput,
  OperatorSessionRecord,
  PersistedOperatorSession,
  SaveOperatorInput
} from "../types.js";

interface OperatorRow {
  operatorId: string;
  operatorCode: string;
  nome: string;
  pinHash: string;
  role: OperatorRecord["role"];
  ativo: number;
  createdAt: string;
  updatedAt: string;
}

interface OperatorSessionRow {
  terminalId: string;
  operatorId: string;
  loginAt: string;
  createdAt: string;
  updatedAt: string;
}

export class OperatorRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  countAll(): number {
    const row = this.#db.prepare("SELECT COUNT(1) AS total FROM operators").get() as { total: number };
    return row.total;
  }

  listActive(): OperatorRecord[] {
    return (this.#db.prepare(
      `
        SELECT
          operator_id AS operatorId,
          operator_code AS operatorCode,
          nome,
          pin_hash AS pinHash,
          role,
          ativo,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM operators
        WHERE ativo = 1
        ORDER BY nome ASC, operator_id ASC
      `
    ).all() as unknown as OperatorRow[]).map(mapOperator);
  }

  findById(operatorId: string): OperatorRecord | null {
    const row = this.#db.prepare(
      `
        SELECT
          operator_id AS operatorId,
          operator_code AS operatorCode,
          nome,
          pin_hash AS pinHash,
          role,
          ativo,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM operators
        WHERE operator_id = :operatorId
      `
    ).get({ operatorId }) as OperatorRow | undefined;

    return row ? mapOperator(row) : null;
  }

  findActiveByPinHash(pinHash: string): OperatorRecord | null {
    const row = this.#db.prepare(
      `
        SELECT
          operator_id AS operatorId,
          operator_code AS operatorCode,
          nome,
          pin_hash AS pinHash,
          role,
          ativo,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM operators
        WHERE pin_hash = :pinHash
          AND ativo = 1
        LIMIT 1
      `
    ).get({ pinHash }) as OperatorRow | undefined;

    return row ? mapOperator(row) : null;
  }

  upsert(input: SaveOperatorInput): OperatorRecord {
    this.#db.prepare(
      `
        INSERT INTO operators (
          operator_id,
          operator_code,
          nome,
          pin_hash,
          role,
          ativo
        )
        VALUES (
          :operatorId,
          :operatorCode,
          :nome,
          :pinHash,
          :role,
          :ativo
        )
        ON CONFLICT(operator_id) DO UPDATE SET
          operator_code = excluded.operator_code,
          nome = excluded.nome,
          pin_hash = excluded.pin_hash,
          role = excluded.role,
          ativo = excluded.ativo,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    ).run({
      operatorId: input.operator.operatorId,
      operatorCode: input.operator.operatorCode,
      nome: input.operator.nome,
      pinHash: input.operator.pinHash,
      role: input.operator.role,
      ativo: input.operator.ativo ? 1 : 0
    });

    const persisted = this.findById(input.operator.operatorId);

    if (!persisted) {
      throw new Error(`Operador nao encontrado apos persistencia: ${input.operator.operatorId}`);
    }

    return persisted;
  }

  findSessionByTerminalId(terminalId: string): PersistedOperatorSession | null {
    const row = this.#db.prepare(
      `
        SELECT
          os.terminal_id AS terminalId,
          os.operator_id AS operatorId,
          os.login_at AS loginAt,
          os.created_at AS createdAt,
          os.updated_at AS updatedAt,
          o.operator_code AS operatorCode,
          o.nome,
          o.pin_hash AS pinHash,
          o.role,
          o.ativo,
          o.created_at AS operatorCreatedAt,
          o.updated_at AS operatorUpdatedAt
        FROM operator_sessions os
        INNER JOIN operators o
          ON o.operator_id = os.operator_id
        WHERE os.terminal_id = :terminalId
        LIMIT 1
      `
    ).get({ terminalId }) as (OperatorSessionRow & OperatorRow & {
      operatorCreatedAt: string;
      operatorUpdatedAt: string;
    }) | undefined;

    if (!row) {
      return null;
    }

    return {
      session: mapOperatorSession(row),
      operator: {
        operatorId: row.operatorId,
        operatorCode: row.operatorCode,
        nome: row.nome,
        pinHash: row.pinHash,
        role: row.role,
        ativo: row.ativo === 1,
        createdAt: row.operatorCreatedAt,
        updatedAt: row.operatorUpdatedAt
      }
    };
  }

  upsertSession(input: OperatorSessionInput): PersistedOperatorSession {
    this.#db.prepare(
      `
        INSERT INTO operator_sessions (
          terminal_id,
          operator_id,
          login_at
        )
        VALUES (
          :terminalId,
          :operatorId,
          :loginAt
        )
        ON CONFLICT(terminal_id) DO UPDATE SET
          operator_id = excluded.operator_id,
          login_at = excluded.login_at,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    ).run({
      terminalId: input.terminalId,
      operatorId: input.operatorId,
      loginAt: input.loginAt
    });

    const persisted = this.findSessionByTerminalId(input.terminalId);

    if (!persisted) {
      throw new Error(`Sessao de operador nao encontrada apos persistencia: ${input.terminalId}`);
    }

    return persisted;
  }

  clearSession(terminalId: string): void {
    this.#db.prepare(
      `
        DELETE FROM operator_sessions
        WHERE terminal_id = :terminalId
      `
    ).run({ terminalId });
  }
}

function mapOperator(row: OperatorRow): OperatorRecord {
  return {
    operatorId: row.operatorId,
    operatorCode: row.operatorCode,
    nome: row.nome,
    pinHash: row.pinHash,
    role: row.role,
    ativo: row.ativo === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function mapOperatorSession(row: OperatorSessionRow): OperatorSessionRecord {
  return {
    terminalId: row.terminalId,
    operatorId: row.operatorId,
    loginAt: row.loginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
