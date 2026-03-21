import type { DatabaseSync } from "node:sqlite";

import type { ProductRecord, SaveProductInput } from "../types.js";

interface ProductRow {
  productId: string;
  nome: string;
  precoCents: number;
  categoria: string;
  setor: string;
  shortcutHint: string;
  ativo: number;
  createdAt: string;
  updatedAt: string;
}

export class ProductRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  countAll(): number {
    const row = this.#db.prepare("SELECT COUNT(1) AS total FROM products").get() as { total: number };
    return row.total;
  }

  listActive(): ProductRecord[] {
    return (this.#db.prepare(
      `
        SELECT
          product_id AS productId,
          nome,
          preco_cents AS precoCents,
          categoria,
          setor,
          shortcut_hint AS shortcutHint,
          ativo,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM products
        WHERE ativo = 1
        ORDER BY categoria ASC, nome ASC, product_id ASC
      `
    ).all() as unknown as ProductRow[]).map(mapProduct);
  }

  findById(productId: string): ProductRecord | null {
    const row = this.#db.prepare(
      `
        SELECT
          product_id AS productId,
          nome,
          preco_cents AS precoCents,
          categoria,
          setor,
          shortcut_hint AS shortcutHint,
          ativo,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM products
        WHERE product_id = :productId
      `
    ).get({ productId }) as ProductRow | undefined;

    return row ? mapProduct(row) : null;
  }

  upsert(input: SaveProductInput): ProductRecord {
    this.#db.prepare(
      `
        INSERT INTO products (
          product_id,
          nome,
          preco_cents,
          categoria,
          setor,
          shortcut_hint,
          ativo
        )
        VALUES (
          :productId,
          :nome,
          :precoCents,
          :categoria,
          :setor,
          :shortcutHint,
          :ativo
        )
        ON CONFLICT(product_id) DO UPDATE SET
          nome = excluded.nome,
          preco_cents = excluded.preco_cents,
          categoria = excluded.categoria,
          setor = excluded.setor,
          shortcut_hint = excluded.shortcut_hint,
          ativo = excluded.ativo,
          updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
      `
    ).run({
      productId: input.product.productId,
      nome: input.product.nome,
      precoCents: input.product.precoCents,
      categoria: input.product.categoria,
      setor: input.product.setor,
      shortcutHint: input.product.shortcutHint,
      ativo: input.product.ativo ? 1 : 0
    });

    const persisted = this.findById(input.product.productId);

    if (!persisted) {
      throw new Error(`Produto nao encontrado apos persistencia: ${input.product.productId}`);
    }

    return persisted;
  }
}

function mapProduct(row: ProductRow): ProductRecord {
  return {
    productId: row.productId,
    nome: row.nome,
    precoCents: row.precoCents,
    categoria: row.categoria,
    setor: row.setor,
    shortcutHint: row.shortcutHint,
    ativo: row.ativo === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
