# Release Report - PDV Rayzen

## Versao
0.1.0

## Ambiente
homolog

## Escopo testado
- Comanda
- Impressao
- Caixa
- Offline
- First-run e instalacao
- Renderer teclado-first
- Electron IPC

## Comandos executados
- `cmd /c pnpm typecheck`
- `cmd /c pnpm build`
- `cmd /c pnpm test:unit`
- `cmd /c pnpm test:integration`
- `cmd /c pnpm test:smoke:offline`
- `cmd /c pnpm test:smoke:install`
- `cmd /c pnpm test:validate:printing`
- `cmd /c pnpm test:validate:cash`

## Resultados
- status: PASS
- [packages/db] 8 runtime checks passed.
- [electron] 12 runtime checks passed.
- [apps/pdv] 13 runtime checks passed.
- [qa/smoke-offline] 5 runtime checks passed.
- [qa/install-smoke] 1 runtime check passed.
- [qa/printing] 3 runtime checks passed.
- [qa/cash] 4 runtime checks passed.

## Riscos restantes
- Homolog ainda depende de validacao manual com impressora real.
- O instalador Squirrel ainda nao completou neste host; o rollout validado continua sendo ZIP com manifesto.
- Node 22 continua sendo a versao alvo; a evidencia atual foi rodada em Node 24.

## Recomendacao de rollout ou piloto
Apto para homolog, com foco em smoke offline, instalacao inicial, impressao por setor e conferencia de caixa.