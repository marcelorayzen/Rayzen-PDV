import type { RayzenDatabaseClient } from "@rayzen/db";
import type { CatalogProduct } from "@rayzen/pdv";

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
