#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const steps = [
  {
    label: "build",
    command: "pnpm build",
    required: true
  },
  {
    label: "install-smoke",
    command: "node ./scripts/run-install-smoke.mjs",
    required: true
  },
  {
    label: "installer",
    command: "pnpm --filter @rayzen/electron make:installer:win",
    required: false
  },
  {
    label: "zip",
    command: "pnpm --filter @rayzen/electron make:win",
    required: true
  },
  {
    label: "manifest",
    command: "pnpm --filter @rayzen/electron artifacts:manifest",
    required: true
  }
];

let installerSucceeded = false;

for (const step of steps) {
  const result = spawnSync("cmd", ["/c", step.command], {
    cwd: process.cwd(),
    stdio: "inherit"
  });

  if (result.status === 0) {
    if (step.label === "installer") {
      installerSucceeded = true;
    }

    continue;
  }

  if (step.required) {
    process.exit(result.status ?? 1);
  }

  console.warn(`[release:manual] etapa opcional falhou (${step.label}); seguindo com fallback ZIP.`);
}

console.log(
  installerSucceeded
    ? "[release:manual] instalador Windows e ZIP de fallback consolidados."
    : "[release:manual] ZIP de fallback consolidado; instalador indisponivel neste host."
);
