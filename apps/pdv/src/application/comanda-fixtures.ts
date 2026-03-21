import type { ComandaPaymentMethod } from "../domain/index.js";
import type { CatalogProduct } from "../domain/catalog.js";

export const COMANDA_CATALOG: readonly CatalogProduct[] = [
  {
    productId: "prod_suco_laranja",
    label: "Suco de laranja",
    setor: "BAR",
    unitPriceCents: 1500,
    shortcutHint: "B1",
    category: "Bebidas"
  },
  {
    productId: "prod_refrigerante_lata",
    label: "Refrigerante lata",
    setor: "BAR",
    unitPriceCents: 900,
    shortcutHint: "B2",
    category: "Bebidas"
  },
  {
    productId: "prod_prato_executivo",
    label: "Prato executivo",
    setor: "COZINHA",
    unitPriceCents: 3200,
    shortcutHint: "C1",
    category: "Cozinha"
  },
  {
    productId: "prod_hamburguer_artesanal",
    label: "Hamburguer artesanal",
    setor: "COZINHA",
    unitPriceCents: 2800,
    shortcutHint: "C2",
    category: "Cozinha"
  },
  {
    productId: "prod_sobremesa_casa",
    label: "Sobremesa da casa",
    setor: "COPA",
    unitPriceCents: 1800,
    shortcutHint: "S1",
    category: "Sobremesas"
  }
] as const;

export const CHECKOUT_METHODS: readonly ComandaPaymentMethod[] = [
  "DINHEIRO",
  "PIX",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
  "OUTRO"
] as const;
