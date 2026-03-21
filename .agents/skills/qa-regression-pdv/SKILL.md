---
name: qa-regression-pdv
description: "PDV Rayzen: planeje e execute regressao focada em PDV offline-first, incluindo comanda, impressao e caixa, e gere evidencias de release. Use para criar ou atualizar testes Jest, roteiros UAT e checklists. Nao use para mudar regras fiscais nem migrations."
---

# PDV Rayzen - QA Regression PDV

## Objetivo

Evitar regressao nos fluxos que quebram operacao: comanda, producao, checkout, caixa e offline.

## Workflow obrigatorio

1. Ler `references/test-matrix.md`, `references/uat-checklist.md` e `references/release-report-template.md`.
2. Escolher escopo minimo de regressao.
3. Atualizar ou gerar testes Jest onde aplicavel.
4. Rodar suites minimas dos pacotes afetados.
5. Rodar `node .agents/skills/qa-regression-pdv/scripts/generate_release_report.mjs`.
6. Entregar evidencias objetivas.

## Guardrails

- Sempre incluir cenarios negativos, como falha de impressora e queda de rede.
- Evidencia deve ser reproduzivel, com comandos e versoes.
- Nao usar dados reais de clientes em fixtures.

## Outputs obrigatorios

- lista de cenarios cobertos
- relatorio de release ou regressao
- riscos remanescentes e recomendacoes de piloto

## Evidencias

- `docs/qa/release-report.md` gerado
- testes dos pacotes afetados passam
