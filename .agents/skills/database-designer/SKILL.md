---
name: database-designer
description: "PDV Rayzen: modele dados, migrations, indices e integridade do SQLite em operacao offline-first. Nao use para mudancas de regra de comanda nem para UI. Esta skill e de alto risco e so deve ser aplicada com migration, rollback e testes."
---

# PDV Rayzen - Database Designer

## Objetivo

Evoluir o schema com seguranca operacional e previsibilidade de rollback.

## Workflow obrigatorio

1. Ler `references/schema-guide.md`, `references/migration-rules.md` e `references/backup-restore.md`.
2. Identificar impacto em tabelas, indices, queries criticas, volume de dados e compatibilidade.
3. Criar migration com `up` e `down`.
4. Ajustar codigo de acesso em `packages/db/**` e callers.
5. Rodar `node .agents/skills/database-designer/scripts/check_migrations.mjs`.
6. Rodar testes minimos de `packages/db` e typecheck.
7. Entregar evidencias objetivas.

## Guardrails

- Nunca alterar dados criticos sem plano de migracao e rollback.
- Nunca rodar DDL manual sem migration versionada.
- Evitar tabelas ou colunas genericas demais em caminhos criticos.
- Nao introduzir nomes, marcas ou artefatos de terceiros em schema, seeds ou docs.

## Outputs obrigatorios

- migration com justificativa
- nota de compatibilidade, se houver quebra
- plano de rollback em um paragrafo
- como validar backup e restore

## Evidencias

- `check_migrations.mjs` passa
- testes de `packages/db` passam
- `docs/db/CHANGELOG.md` foi atualizado, se existir; senao, deve ser criado ao aplicar a skill
