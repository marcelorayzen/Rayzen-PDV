# Deployment e Release - Rayzen PDV

> Baseline atual: Electron Forge para Windows, rollout manual, first-run guiado e sem auto-update.

## Objetivo

Garantir builds reproduziveis, artefatos versionados e suporte de campo para um PDV desktop offline-first.

## Estrategia atual

- packaging feito em `electron/` com Electron Forge
- rollout manual e controlado por versao
- artefato minimo obrigatorio para distribuicao manual: ZIP versionado
- tentativa de instalador Squirrel no fluxo de release, sem bloquear o rollout quando o host nao suportar esse maker
- manifesto local de release com checksum e metadados
- auto-update desabilitado no MVP
- assinatura de codigo continua obrigatoria antes da primeira ida para `prod`

## Scripts oficiais

Na raiz do workspace:

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:smoke:offline`
- `pnpm test:smoke:install`
- `pnpm test:validate:printing`
- `pnpm test:validate:cash`
- `pnpm qa:homolog`
- `pnpm qa:pilot`
- `pnpm package:win`
- `pnpm make:win`
- `pnpm make:installer:win`
- `pnpm release:manual`

Comportamento atual dos scripts:

- `pnpm package:win` monta o app staged e gera o pacote bruto do Electron
- `pnpm make:win` gera ZIP em `electron/out/make/`
- `pnpm make:installer:win` aciona o maker Squirrel em target dedicado
- `pnpm release:manual` roda build, smoke de instalacao, tenta o maker Squirrel e sempre consolida a release versionada em `electron/out/releases/vX.Y.Z/windows/`

## Estrutura de packaging

Fluxo atual do packaging:

1. build TypeScript do workspace
2. staging do renderer em `electron/builders/app-package/resources/renderer/`
3. staging do app Electron limpo em `electron/builders/app-package/`
4. execucao do Forge sobre o staging
5. tentativa do maker Squirrel para `Setup.exe`
6. fallback garantido para ZIP
7. coleta dos artefatos e geracao de `manual-rollout-manifest.json`

Esse fluxo evita acoplamento do artefato final ao layout do workspace de desenvolvimento.

## Artefatos esperados

Em uma release manual aprovada, esperar:

- pasta versionada em `electron/out/releases/vX.Y.Z/windows/`
- `manual-rollout-manifest.json`
- ao menos um ZIP versionado
- instalador Windows quando o maker Squirrel completar no host de release

Metadados atuais do manifesto:

- `rolloutMode: manual`
- `autoUpdate: false`
- lista de artefatos com `kind`, nome final, tamanho e `sha256`

## CI/CD minimo

Qualquer pipeline adotado deve preservar, no minimo:

1. `pnpm install`
2. `pnpm typecheck`
3. `pnpm build`
4. `pnpm test`
5. `pnpm test:unit`
6. `pnpm test:integration`
7. `pnpm test:smoke:offline`
8. `pnpm test:smoke:install`
9. `pnpm qa:homolog`
10. `pnpm release:manual`

Observacoes:

- `pnpm lint` ainda e placeholder e nao pode ser tratado como gate de release
- o rollout manual atual depende do manifesto e da distribuicao controlada do artefato aprovado

## Versionamento

Baseline atual:

- SemVer com serie `0.x` enquanto o produto estiver em MVP
- tags no formato `vX.Y.Z`
- changelog por release

## Checklist de release

- [ ] versao atualizada no workspace
- [ ] `pnpm typecheck`, `pnpm build` e `pnpm test` passaram
- [ ] `pnpm test:unit`, `pnpm test:integration`, `pnpm test:smoke:offline` e `pnpm test:smoke:install` passaram
- [ ] `pnpm test:validate:printing` e `pnpm test:validate:cash` passaram
- [ ] `pnpm qa:homolog` executado para promover de `dev`
- [ ] `pnpm qa:pilot` executado antes de promover um pacote validado em campo
- [ ] `pnpm make:win` e `pnpm release:manual` executados
- [ ] `manual-rollout-manifest.json` validado
- [ ] `docs/qa/release-report-homolog.md` revisado
- [ ] `docs/qa/release-report-pilot.md` revisado quando houver piloto
- [ ] smoke offline executado em ambiente de homolog
- [ ] impressao validada em impressora real quando o release tocar spool
- [ ] backup e restore validados quando o release tocar persistencia ou suporte
- [ ] runbooks revisados
- [ ] politica de logs e PII revisada
- [ ] assinatura de codigo aplicada antes de promover para `prod`

## Promocao entre ambientes

- `dev -> homolog`: validacao tecnica, smoke offline e artefato manual gerado
- `homolog -> pilot`: `pnpm qa:homolog` aprovado, release manual validada, impressora real validada, backup/restore testados e release report emitido
- relatorios de apoio: `docs/qa/release-report-homolog.md` e `docs/qa/release-report-pilot.md`
- `pilot -> prod`: piloto aprovado, fiscal revisada para o escopo atendido, assinatura de codigo aplicada e rollout manual controlado

## Rollback

Fluxo baseline:

1. suspender a distribuicao da versao com falha
2. reinstalar pelo ultimo instalador aprovado ou reextrair o ultimo ZIP aprovado
3. restaurar backup valido do terminal quando necessario
4. reiniciar o app
5. executar smoke offline minimo
6. registrar incidente, versao revertida e evidencias

## Observacoes operacionais

- o `runtime-config.json` em `%ProgramData%\\RayzenPDV\\config\\` guarda o estado do first-run, empresa local, caminho opcional do logo da marca e impressoras do terminal
- o ZIP continua sendo o baseline oficial de rollout manual e de rollback rapido
- o target Squirrel e tentado no `release:manual`, mas o rollout nao para quando o host so conseguir gerar o ZIP
- o app desktop nao expoe API HTTP local; suporte, backup, restore, spool e fiscal seguem via IPC e arquivos locais
