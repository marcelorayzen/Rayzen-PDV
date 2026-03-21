---
name: electron-installer
description: "PDV Rayzen: trate empacotamento, instalador, configuracao de primeiro uso, logs e suporte de campo do app Electron. Nao use para mudar regra de comanda ou UI. Esta skill e de alto risco e exige checklist e evidencias de release."
---

# PDV Rayzen - Electron Installer

## Objetivo

Garantir instalador e release repetiveis, com validacao em campo e capacidade de diagnostico offline.

## Workflow obrigatorio

1. Ler `references/packaging-checklist.md`, `references/installer-config.md` e `references/field-support.md`.
2. Identificar tooling do repo em `electron/**`.
3. Ajustar identidade do app, paths de logs e first-run wizard, se existir.
4. Rodar `node .agents/skills/electron-installer/scripts/verify_electron_project_shape.mjs`.
5. Gerar build local com o comando do repositorio.
6. Gerar evidencias e runbook.

## Guardrails

- Nunca publicar instalavel sem versao e changelog.
- Build deve ser reproduzivel.
- Logs nao devem conter dados pessoais desnecessarios.
- Marcas e strings devem ser do PDV Rayzen.

## Outputs obrigatorios

- checklist de empacotamento preenchido
- instrucao de instalacao e rollback
- manifesto de release

## Evidencias

- verificador passa
- build gera artefato instalavel
- `docs/runbooks/` foi atualizado ao aplicar a skill
