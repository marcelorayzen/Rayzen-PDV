import { randomUUID } from "node:crypto";

import type { RayzenDatabaseClient } from "@rayzen/db";
import type { CatalogProduct } from "@rayzen/pdv";

import type { CatalogUpsertProductRequest } from "../../contracts/ipc.js";

export class CatalogService {
  readonly #database: RayzenDatabaseClient;

  constructor(database: RayzenDatabaseClient) {
    this.#database = database;
  }

  listProducts(): CatalogProduct[] {
    return this.#database.products.listActive().map((product) => ({
      productId: product.productId,
      label: product.nome,
      setor: product.setor,
      unitPriceCents: product.precoCents,
      shortcutHint: product.shortcutHint,
      category: product.categoria
    }));
  }

  upsertProduct(request: CatalogUpsertProductRequest): CatalogProduct {
    const productId = request.productId?.trim() || randomUUID();
    const record = this.#database.products.upsert({
      product: {
        productId,
        nome: request.nome.trim(),
        precoCents: request.precoCents,
        categoria: request.categoria.trim(),
        setor: request.setor.trim(),
        shortcutHint: request.shortcutHint.trim(),
        ativo: true
      }
    });
    return {
      productId: record.productId,
      label: record.nome,
      setor: record.setor,
      unitPriceCents: record.precoCents,
      shortcutHint: record.shortcutHint,
      category: record.categoria
    };
  }

  findProduct(productId: string): CatalogProduct | null {
    const product = this.#database.products.findById(productId);

    if (!product || !product.ativo) {
      return null;
    }

    return {
      productId: product.productId,
      label: product.nome,
      setor: product.setor,
      unitPriceCents: product.precoCents,
      shortcutHint: product.shortcutHint,
      category: product.categoria
    };
  }
}
