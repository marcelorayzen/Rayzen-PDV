---
name: cash-control-engine
description: "PDV Rayzen: trate regras e fluxos de caixa, incluindo abertura, sangria, suprimento, fechamento e conferencia por forma e operador. Nao use para UI pura. Esta skill e de alto risco e exige auditoria e testes de regressao."
---

# PDV Rayzen - Cash Control Engine

## Objetivo

Garantir integridade do caixa: totais, divergencias, auditoria e fechamento confiavel offline.

## Workflow obrigatorio

1. Ler `references/cash-lifecycle.md`, `references/reconciliation-rules.md` e `references/audit-requirements.md`.
2. Identificar a regra afetada: formas de pagamento, parcial, troco ou estorno.
3. Implementar mudanca minima no dominio e na persistencia.
4. Atualizar `examples/cash_session.json`.
5. Rodar `node .agents/skills/cash-control-engine/scripts/check_cash_math.mjs`.
6. Rodar testes minimos de `apps/pdv` e `packages/db`, quando aplicavel.

## Guardrails

- Fechamento e ponto de auditoria; qualquer ajuste precisa de trilha.
- Divergencia nao pode ser apagada; registrar diferenca e justificativa.
- Nao permitir fechamento se houver comandas em pagamento, salvo regra explicita e auditada.
- Nunca introduzir strings, docs ou UI de terceiros.

## Outputs obrigatorios

- regra alterada com antes e depois
- totais ou relatorios afetados
- evidencias de calculo

## Evidencias

- `check_cash_math.mjs` passa
- testes dos pacotes afetados passam
