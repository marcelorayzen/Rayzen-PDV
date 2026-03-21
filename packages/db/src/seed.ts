import { createHash } from "node:crypto";

import type { RayzenDatabaseClient } from "./client.js";

export interface SeedResult {
  seededOperators: number;
  seededProducts: number;
  seededPrintRoutes: number;
}

export function seedInitialFoundationIfEmpty(client: RayzenDatabaseClient): SeedResult {
  let seededOperators = 0;
  let seededProducts = 0;
  let seededPrintRoutes = 0;

  client.transaction(() => {
    if (client.operators.countAll() === 0) {
      client.operators.upsert({
        operator: {
          operatorId: "opr_admin_01",
          operatorCode: "ADMIN",
          nome: "ADMIN",
          pinHash: hashPin("1234"),
          role: "GERENTE",
          ativo: true
        }
      });
      seededOperators = 1;
    }

    if (client.products.countAll() === 0) {
      for (const product of INITIAL_PRODUCTS) {
        client.products.upsert({
          product
        });
        seededProducts += 1;
      }
    }

    if (client.printRouting.countAll() === 0) {
      for (const route of INITIAL_PRINT_ROUTES) {
        client.printRouting.upsert({
          route
        });
        seededPrintRoutes += 1;
      }
    }
  });

  return {
    seededOperators,
    seededProducts,
    seededPrintRoutes
  };
}

export function hashPin(pin: string): string {
  return createHash("sha256").update(pin, "utf8").digest("hex");
}

const INITIAL_PRODUCTS = [
  {
    productId: "prod_hamburguer",
    nome: "Hamburguer",
    precoCents: 2800,
    categoria: "Lanches",
    setor: "COZINHA",
    shortcutHint: "L1",
    ativo: true
  },
  {
    productId: "prod_batata_frita",
    nome: "Batata frita",
    precoCents: 1600,
    categoria: "Lanches",
    setor: "COZINHA",
    shortcutHint: "L2",
    ativo: true
  },
  {
    productId: "prod_refrigerante",
    nome: "Refrigerante",
    precoCents: 900,
    categoria: "Bebidas",
    setor: "BAR",
    shortcutHint: "B1",
    ativo: true
  },
  {
    productId: "prod_cerveja",
    nome: "Cerveja",
    precoCents: 1200,
    categoria: "Bebidas",
    setor: "BAR",
    shortcutHint: "B2",
    ativo: true
  }
] as const;

const INITIAL_PRINT_ROUTES = [
  {
    setor: "BAR",
    printerName: "IMP_BAR_01"
  },
  {
    setor: "CAIXA",
    printerName: "IMP_CAIXA_01"
  },
  {
    setor: "COZINHA",
    printerName: "IMP_COZINHA_01"
  }
] as const;
