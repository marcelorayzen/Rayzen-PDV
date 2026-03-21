import type { DatabaseSync } from "node:sqlite";

import type {
  PrintSectorRoutingRecord,
  SavePrintSectorRoutingInput
} from "../types.js";

interface PrintSectorRoutingRow {
  setor: string;
  printerName: string;
  createdAt: string;
  updatedAt: string;
}

export class PrintRoutingRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  countAll(): number {
    const row = this.#db.prepare("SELECT COUNT(1) AS total FROM print_sector_routing").get() as { total: number };
    return row.total;
  }

  listAll(): PrintSectorRoutingRecord[] {
    return (this.#db.prepare(
      `
        SELECT
          setor,
          printer_name AS printerName,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM print_sector_routing
        ORDER BY setor ASC
      `
    ).all() as unknown as PrintSectorRoutingRow[]).map(mapRoute);
  }

  findBySetor(setor: string): PrintSectorRoutingRecord | null {
    const row = this.#db.prepare(
      `
        SELECT
          setor,
          printer_name AS printerName,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM print_sector_routing
        WHERE setor = :setor
        LIMIT 1
      `
    ).get({ setor }) as PrintSectorRoutingRow | undefined;

    return row ? mapRoute(row) : null;
  }

  upsert(input: SavePrintSectorRoutingInput): PrintSectorRoutingRecord {
    this.#db.prepare(
      `
        INSERT INTO print_sector_routing (
          setor,
          printer_name
        )
        VALUES (
          :setor,
          :printerName
        )
        ON CONFLICT(setor) DO UPDATE SET
          printer_name = excluded.printer_name,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    ).run({
      setor: input.route.setor,
      printerName: input.route.printerName
    });

    const persisted = this.findBySetor(input.route.setor);

    if (!persisted) {
      throw new Error(`Rota de impressao nao encontrada apos persistencia: ${input.route.setor}`);
    }

    return persisted;
  }
}

function mapRoute(row: PrintSectorRoutingRow): PrintSectorRoutingRecord {
  return {
    setor: row.setor,
    printerName: row.printerName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
