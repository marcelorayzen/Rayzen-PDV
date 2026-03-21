#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const sourcePath = path.resolve(
  process.cwd(),
  args.input ?? ".agents/skills/qa-regression-pdv/examples/sample_run.json"
);
const outputPath = path.resolve(
  process.cwd(),
  args.output ?? "docs/qa/release-report.md"
);

const run = JSON.parse(readFileSync(sourcePath, "utf8"));
mkdirSync(path.dirname(outputPath), { recursive: true });

const markdown = [
  "# Release Report - PDV Rayzen",
  "",
  "## Versao",
  run.version,
  "",
  "## Ambiente",
  run.stage ?? "nao informado",
  "",
  "## Escopo testado",
  ...run.scope.map((item) => `- ${item}`),
  "",
  "## Comandos executados",
  ...run.commands.map((command) => `- \`${command}\``),
  "",
  "## Resultados",
  `- status: ${run.status}`,
  ...(run.evidences ?? []).map((evidence) => `- ${evidence}`),
  "",
  "## Riscos restantes",
  ...run.risks.map((risk) => `- ${risk}`),
  "",
  "## Recomendacao de rollout ou piloto",
  run.recommendation ?? "Sem recomendacao registrada."
].join("\n");

writeFileSync(outputPath, markdown, "utf8");

console.log(`[qa-regression-pdv] OK: ${path.relative(process.cwd(), outputPath)} gerado.`);

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--input") {
      parsed.input = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--output") {
      parsed.output = argv[index + 1];
      index += 1;
    }
  }

  return parsed;
}
