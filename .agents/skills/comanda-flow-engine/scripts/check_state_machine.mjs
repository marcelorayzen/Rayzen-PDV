#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";

const filePath = path.resolve(
  process.cwd(),
  ".agents/skills/comanda-flow-engine/examples/comanda_state_machine.json",
);

const data = JSON.parse(readFileSync(filePath, "utf8"));
const requiredStates = [
  "ABERTA",
  "EM_PRODUCAO",
  "EM_PAGAMENTO",
  "ENCERRADA",
  "CANCELADA",
];
const finalStates = new Set(["ENCERRADA", "CANCELADA"]);

function fail(message) {
  console.error(`[comanda-flow-engine] FAIL: ${message}`);
  process.exit(1);
}

for (const state of requiredStates) {
  if (!data.states.includes(state)) {
    fail(`Estado ausente: ${state}`);
  }
}

for (const [from, targets] of Object.entries(data.transitions)) {
  if (!data.states.includes(from)) {
    fail(`Transicao com estado origem invalido: ${from}`);
  }

  for (const target of targets) {
    if (!data.states.includes(target)) {
      fail(`Transicao para estado inexistente: ${from} -> ${target}`);
    }

    if (finalStates.has(from)) {
      fail(`Estado final nao pode ter saida: ${from} -> ${target}`);
    }
  }
}

if (data.transitions.ENCERRADA?.length) {
  fail("ENCERRADA nao pode ter transicoes de saida.");
}

if (data.transitions.CANCELADA?.length) {
  fail("CANCELADA nao pode ter transicoes de saida.");
}

console.log("[comanda-flow-engine] OK: maquina de estados valida.");
