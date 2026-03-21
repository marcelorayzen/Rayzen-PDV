---
name: comanda-flow-engine
description: "PDV Rayzen: implemente ou altere regras do ciclo de vida da comanda, incluindo abrir, lancar itens, enviar producao, pre-conta, checkout e encerramento. Nao use para mudancas visuais puras, migrations ou drivers de impressao. Use quando um bug ou regra envolver estados, transicoes, split, cancelamentos, descontos, auditoria e compatibilidade offline-first."
---

# PDV Rayzen - Comanda Flow Engine

## Objetivo

Manter o dominio de comanda correto, auditavel e previsivel em operacao offline-first.

## Escopo

Inclui:

- maquina de estados da comanda e regras de transicao
- regras de item, split, descontos e cancelamentos com motivo
- contratos de dominio e eventos de auditoria
- compatibilidade com fila de producao e checkout

Exclui:

- layout, estilos e UX; use `pdv-ui-builder`
- schema e migrations; use `database-designer`
- spool e driver de impressao; use `kitchen-router`
- NFC-e; use `fiscal-nfce`
- build e instalador; use `electron-installer`

## Workflow obrigatorio

1. Entender o pedido: identificar qual regra mudou e qual estado ou acao esta quebrando a operacao.
2. Ler `references/domain-model.md`, `references/invariants.md` e `references/api-contracts.md`.
3. Mapear impacto em `apps/pdv/src/domain/comanda/**`, `packages/db/**` e, so se necessario, `apps/pdv/**`.
4. Implementar mudanca minima, centralizando a regra no dominio.
5. Atualizar testes e fixtures.
6. Rodar `node .agents/skills/comanda-flow-engine/scripts/check_state_machine.mjs`.
7. Rodar testes do repositorio, no minimo os pacotes afetados e o typecheck.
8. Entregar evidencias objetivas.

## Guardrails

- Nunca permitir transicao para tras a partir de `ENCERRADA` ou `CANCELADA`.
- Nunca editar item `ENVIADO` sem evento de correcao ou cancelamento com motivo.
- Nunca depender de rede para abrir comanda, lancar item, enviar producao ou fechar.
- Sempre registrar eventos criticos de abertura, envio, cancelamento, desconto, split e encerramento.
- Nunca introduzir nomes, marcas ou artefatos de terceiros em codigo, UI, strings ou docs.

## Outputs obrigatorios

### Mudanca aplicada

- regra alterada em um paragrafo, com antes e depois
- estados e transicoes afetados

### Arquivos alterados

- caminho e motivo

### Testes executados

- comandos e resultado

### Riscos restantes

- pontos que exigem review humano

## Evidencias

- `scripts/check_state_machine.mjs` passa
- testes dos pacotes afetados passam
- `examples/comanda_events.ndjson` foi atualizado se a regra mudou
