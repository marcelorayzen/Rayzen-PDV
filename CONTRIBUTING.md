# Contribuindo com o Rayzen PDV

Este guia padroniza estilo, validacao tecnica e processo de release do projeto.

## Principios

- Offline-first: nao introduzir dependencia de internet em fluxos criticos.
- Mudanca minima: refatorar apenas o necessario para resolver o problema.
- Testes e evidencias: toda mudanca deve vir com validacao proporcional.
- IP/Legal: design e copy devem ser originais do Rayzen PDV.

## Setup local

### Instalar dependencias

```bash
pnpm install
```

Pre-requisitos atuais:

- Node.js 22 LTS
- pnpm 10.x

### Rodar typecheck

```bash
pnpm typecheck
```

### Gerar build base

```bash
pnpm build
```

### Rodar testes

```bash
pnpm test
```

### Observacao

- `pnpm test` ja executa os testes disponiveis dos workspaces.
- `pnpm test:unit` e `pnpm test:integration` cobrem a base Jest de regressao.
- `pnpm qa:homolog` e `pnpm qa:pilot` geram evidencias e release reports em `docs/qa/`.
- `pnpm lint` ainda e placeholder no estado atual do repositorio.
- O workspace ja possui `package.json` raiz, `pnpm-workspace.yaml`, `tsconfig` base e quatro workspaces iniciais.
- `electron/` ja contem processo principal, IPC, logs locais, backup/restore, spool, fiscal e packaging Windows.

## Estilo de codigo

- TypeScript estrito, quando aplicavel.
- Nomes claros e sem abreviacoes ambiguas.
- Evitar magic numbers; preferir constantes nomeadas.
- Priorizar funcoes puras no dominio e encapsular efeitos colaterais em IPC, DB, impressao e integracoes.

## Checklist de PR

- [ ] A mudanca tem escopo pequeno e justificativa clara.
- [ ] Nao introduz dependencia de internet em fluxo critico.
- [ ] Regras de dominio foram atualizadas em `docs/DOMAIN.md`, quando aplicavel.
- [ ] Testes foram adicionados ou atualizados.
- [ ] Smoke offline foi validado, quando tocar fluxo operacional.
- [ ] Nenhuma referencia a concorrentes foi introduzida em codigo, docs, dados ou assets.
- [ ] Logs e evidencias nao incluem PII.

## Processo de release

1. Atualizar versao.
2. Rodar testes.
3. Gerar build Electron.
4. Atualizar changelog.
5. Validar em piloto controlado.
6. Publicar artefatos.
