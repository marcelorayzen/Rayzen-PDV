#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const filePath = path.resolve(
  process.cwd(),
  ".agents/skills/cash-control-engine/examples/cash_session.json",
);

const session = JSON.parse(readFileSync(filePath, "utf8"));

function fail(message) {
  console.error(`[cash-control-engine] FAIL: ${message}`);
  process.exit(1);
}

function sum(items) {
  return items.reduce((accumulator, item) => accumulator + Number(item.valor || 0), 0);
}

const expected = sum(
  session.pagamentos.filter((payment) => payment.status === "CONFIRMADO"),
);

if (Number(session.totais.esperado) !== expected) {
  fail(`Totais divergentes. esperado=${expected} arquivo=${session.totais.esperado}`);
}

console.log("[cash-control-engine] OK: totais conferem.");
