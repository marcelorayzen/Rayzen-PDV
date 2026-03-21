# Builders

Base de build e empacotamento introduzida na chamada 12:

- `../forge.config.cjs`: entrada padrao do Electron Forge para o workspace `electron`
- `forge.config.cjs`: baseline oficial do Electron Forge para Windows, reaproveitado pela entrada padrao
- `stage-renderer.mjs`: copia `apps/pdv/index.html`, `shell.css` e `dist/` para `builders/renderer`
- `stage-forge-app.mjs`: monta um app limpo em `builders/app-package` para o Forge, com `dist/`, renderer e `@rayzen/db`
- `collect-release-artifacts.mjs`: consolida os artefatos gerados em `electron/out/releases/vX.Y.Z/windows/`

Fluxo esperado:

1. `pnpm build`
2. `pnpm test:smoke:install`
3. `pnpm --filter @rayzen/electron stage:app`
4. `pnpm --filter @rayzen/electron make:installer:win`
5. `pnpm --filter @rayzen/electron make:win`
6. `pnpm --filter @rayzen/electron artifacts:manifest`
7. ou `pnpm release:manual` para executar esse fluxo com fallback ZIP

Targets disponiveis:

- `make:win`: ZIP versionado para rollout manual
- `make:installer:win`: alvo Squirrel para instalador Windows
- `release:manual`: tenta o instalador Squirrel, mantem ZIP como fallback e consolida o manifesto versionado
