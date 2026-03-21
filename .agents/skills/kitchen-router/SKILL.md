---
name: kitchen-router
description: "PDV Rayzen: trate roteamento de producao com spool persistente, idempotencia e reimpressao. Nao use para UI nem para regras de comanda. Use quando houver bugs de impressao, fila, setor, segunda via, falhas e recuperacao offline."
---

# PDV Rayzen - Kitchen Router

## Objetivo

Garantir que enviar para producao funcione offline e tolere falhas de impressora, rede e papel.

## Workflow obrigatorio

1. Ler `references/routing-rules.md`, `references/failure-policy.md` e `references/ticket-format.md`.
2. Identificar o caminho em `electron/**` e, se necessario, `apps/pdv/**`.
3. Implementar roteamento por setor, spool persistente e idempotencia.
4. Atualizar `examples/routing_config.json` se a configuracao mudar.
5. Rodar `node .agents/skills/kitchen-router/scripts/validate_routing_config.mjs`.
6. Rodar testes minimos do pacote afetado.

## Guardrails

- Falha de impressora nao bloqueia venda; o job entra na fila.
- Reimpressao deve marcar segunda via e registrar evento.
- Nao inventar driver nem quebrar a abstracao de impressao do projeto.
- Textos e templates de ticket devem ser originais do PDV Rayzen.

## Outputs obrigatorios

- descricao do roteamento antes e depois
- lista de setores e regras
- evidencia de spool e reprocessamento

## Evidencias

- validador de config passa
- testes dos pacotes afetados passam
