---
name: pdv-ui-builder
description: "PDV Rayzen: construa ou altere a UI do PDV com foco em teclado-first, densidade, estados operacionais e fluxos rapidos como comanda, catalogo e checkout. Nao use para mudar regras de dominio nem para schema ou migrations. Use quando o problema for UX, atalhos, estados, acessibilidade pragmatica e performance de render."
---

# PDV Rayzen - PDV UI Builder

## Objetivo

Entregar UI previsivel para alta demanda, com poucos cliques, atalhos consistentes e feedback operacional claro.

## Workflow obrigatorio

1. Ler `references/ui-principles.md`, `references/keyboard-shortcuts.md` e `references/accessibility-pragmatic.md`.
2. Localizar telas em `apps/pdv/**` e componentes em `packages/ui/**`.
3. Implementar mudanca minima mantendo foco, atalhos e estados visiveis.
4. Atualizar `examples/shortcuts.json` se atalhos mudarem.
5. Rodar `node .agents/skills/pdv-ui-builder/scripts/check_shortcuts_fixture.mjs`.
6. Rodar testes minimos do app e typecheck.

## Guardrails

- Nunca depender apenas de cor para estados.
- Em modais, prender o foco e devolver o foco ao fechar.
- Textos e labels devem ser originais do PDV Rayzen.
- Atalhos so mudam com motivo, mapa atualizado e testes.

## Outputs obrigatorios

- o que mudou, com descricao do fluxo ou screenshots
- arquivos alterados
- lista de atalhos afetados
- testes executados

## Evidencias

- verificador de atalhos passa
- testes do app passam
- `examples/error_copy.md` foi atualizado se mensagens mudaram
