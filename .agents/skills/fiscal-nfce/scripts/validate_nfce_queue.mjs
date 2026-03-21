#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const queuePath = path.resolve(
  process.cwd(),
  ".agents/skills/fiscal-nfce/examples/nfce_queue.json",
);

const queue = JSON.parse(readFileSync(queuePath, "utf8"));
const allowed = new Set([
  "DRAFT",
  "SIGNED",
  "SENT",
  "AUTHORIZED",
  "CONTINGENCY",
  "REJECTED",
]);

function fail(message) {
  console.error(`[fiscal-nfce] FAIL: ${message}`);
  process.exit(1);
}

for (const document of queue.documentos) {
  if (!allowed.has(document.status)) {
    fail(`Status invalido: ${document.status}`);
  }

  if (document.status === "REJECTED" && !document.ultimoErro) {
    fail("REJECTED exige ultimoErro.");
  }

  if (document.status === "CONTINGENCY" && document.tentativas < 0) {
    fail("Tentativas invalidas.");
  }
}

console.log("[fiscal-nfce] OK: fila fiscal valida.");
