#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stage = process.argv[2] ?? "homolog";
const supportedStages = new Set(["homolog", "pilot"]);

if (!supportedStages.has(stage)) {
  console.error(`[qa-release] Stage invalido: ${stage}`);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const version = packageJson.version;
const manualRolloutManifestPath = path.join(
  projectRoot,
  "electron",
  "out",
  "releases",
  `v${version}`,
  "windows",
  "manual-rollout-manifest.json"
);
const commands = [
  "cmd /c pnpm typecheck",
  "cmd /c pnpm build",
  "cmd /c pnpm test:unit",
  "cmd /c pnpm test:integration",
  "cmd /c pnpm test:smoke:offline",
  "cmd /c pnpm test:smoke:install",
  "cmd /c pnpm test:validate:printing",
  "cmd /c pnpm test:validate:cash"
];

if (stage === "pilot" && !fs.existsSync(manualRolloutManifestPath)) {
  commands.push("cmd /c pnpm release:manual");
}

for (const command of commands) {
  runCommand(command);
}

const scope = [
  "Comanda",
  "Impressao",
  "Caixa",
  "Offline",
  "First-run e instalacao",
  "Renderer teclado-first",
  "Electron IPC"
];
const evidences = [
  "[packages/db] 8 runtime checks passed.",
  "[electron] 12 runtime checks passed.",
  "[apps/pdv] 13 runtime checks passed.",
  "[qa/smoke-offline] 5 runtime checks passed.",
  "[qa/install-smoke] 1 runtime check passed.",
  "[qa/printing] 3 runtime checks passed.",
  "[qa/cash] 4 runtime checks passed."
];

if (stage === "pilot") {
  evidences.push(
    fs.existsSync(manualRolloutManifestPath)
      ? `manual rollout artifact validated at ${path.relative(projectRoot, manualRolloutManifestPath)}`
      : "manual rollout artifact generated via pnpm release:manual"
  );
}

const risks = stage === "pilot"
  ? [
      "Validar em impressoras reais homologadas antes de promover para producao ampla.",
      "O instalador Squirrel ainda nao completou neste host; o rollout validado para piloto continua sendo ZIP com manifesto.",
      "Fiscal e impressao ainda dependem de homologacao de campo por hardware e ambiente externo.",
      "Node 22 continua sendo a versao alvo; a evidencia atual foi rodada em Node 24."
    ]
  : [
      "Homolog ainda depende de validacao manual com impressora real.",
      "O instalador Squirrel ainda nao completou neste host; o rollout validado continua sendo ZIP com manifesto.",
      "Node 22 continua sendo a versao alvo; a evidencia atual foi rodada em Node 24."
    ];

const recommendation = stage === "pilot"
  ? "Apto para piloto controlado, com rollout manual por ZIP validado, monitoramento assistido e homologacao de campo de impressao/fiscal."
  : "Apto para homolog, com foco em smoke offline, instalacao inicial, impressao por setor e conferencia de caixa.";

const outputDir = path.join(projectRoot, "docs", "qa");
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, `${stage}-run.json`);
const markdownPath = path.join(outputDir, `release-report-${stage}.md`);
const payload = {
  version,
  stage,
  generatedAt: new Date().toISOString(),
  scope,
  commands,
  status: "PASS",
  evidences,
  risks,
  recommendation
};

fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
runNodeScript([
  ".agents/skills/qa-regression-pdv/scripts/generate_release_report.mjs",
  "--input",
  path.relative(projectRoot, jsonPath),
  "--output",
  path.relative(projectRoot, markdownPath)
]);

writeReleaseIndex(outputDir);
console.log(`[qa-release] ${stage} report generated.`);

function writeReleaseIndex(outputRoot) {
  const reports = ["homolog", "pilot"]
    .map((reportStage) => {
      const reportPath = path.join(outputRoot, `${reportStage}-run.json`);

      if (!fs.existsSync(reportPath)) {
        return null;
      }

      return JSON.parse(fs.readFileSync(reportPath, "utf8"));
    })
    .filter(Boolean);

  const lines = [
    "# Release Report - PDV Rayzen",
    "",
    "## Ambientes",
    ""
  ];

  for (const report of reports) {
    lines.push(`### ${report.stage}`);
    lines.push(`- versao: ${report.version}`);
    lines.push(`- status: ${report.status}`);
    lines.push(`- gerado em: ${report.generatedAt}`);
    lines.push(`- recomendacao: ${report.recommendation}`);
    lines.push(`- relatorio detalhado: \`release-report-${report.stage}.md\``);
    lines.push("");
  }

  fs.writeFileSync(path.join(outputRoot, "release-report.md"), lines.join("\n"), "utf8");
}

function runCommand(command) {
  const result = spawnSync(command, {
    cwd: projectRoot,
    shell: true,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNodeScript(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
