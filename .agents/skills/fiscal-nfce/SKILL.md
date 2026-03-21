---
name: fiscal-nfce
description: "PDV Rayzen: trate fila fiscal e emissao de NFC-e com operacao offline em contingencia, transmissao posterior e rejeicoes. Nao use para UI nem para regras gerais de comanda. Esta skill e de altissimo risco e exige validacao com consultoria fiscal e testes ponta a ponta."
---

# PDV Rayzen - Fiscal NFC-e

## Contexto essencial

Contingencia existe quando nao for possivel transmitir ou obter resposta. Nao inventar regra fiscal; validar detalhes por UF, ambiente e MOC vigente.

## Workflow obrigatorio

1. Ler `references/contingency.md`, `references/fiscal-states.md` e `references/rejection-handling.md`.
2. Identificar requisito por UF e ambiente.
3. Implementar fila fiscal persistente, painel de pendencias e job de retry.
4. Atualizar `examples/nfce_queue.json`.
5. Rodar `node .agents/skills/fiscal-nfce/scripts/validate_nfce_queue.mjs`.
6. Rodar testes dos pacotes afetados.

## Guardrails

- Nao alterar regra fiscal sem validacao explicita.
- Minimizar e proteger dados pessoais; nao usar PII real em logs ou fixtures.
- Sempre registrar eventos de emissao, contingencia, transmissao, rejeicao e cancelamento.
- Strings e templates devem ser originais do PDV Rayzen.

## Outputs obrigatorios

- descricao do fluxo fiscal implementado
- tabela de estados e transicoes
- plano de excecoes para rejeicao, timeout e reprocessamento
- evidencias de script e testes

## Evidencias

- `validate_nfce_queue.mjs` passa
- testes dos pacotes afetados passam
- `docs/fiscal/README.md` foi criado ou atualizado ao aplicar a skill
