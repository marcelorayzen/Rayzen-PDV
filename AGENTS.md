# AGENTS.md

## Projeto

Rayzen PDV e um PDV desktop offline-first para bares e restaurantes.

Arquitetura-alvo documentada:

- `apps/pdv/`: renderer e fluxos operacionais
- `packages/ui/`: design system e componentes compartilhados
- `packages/db/`: SQLite, migrations, queries e rotinas de backup
- `electron/`: processo principal, impressao e empacotamento
- `docs/`: arquitetura, dominio, deployment, seguranca e runbooks

Estado atual do repositorio:

- Este workspace foi inicializado com documentacao e skills.
- Ainda nao assuma que `apps/pdv/`, `packages/db/`, `packages/ui/`, `electron/` ou `package.json` existam.
- Se uma pasta ou comando esperado nao existir, declare isso explicitamente e ajuste o trabalho ao estado real do repo.

## Fontes de verdade

Use estes arquivos como base antes de propor comportamento novo:

- `README.md`
- `CONTRIBUTING.md`
- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/DOMAIN.md`
- `docs/TECH_DECISIONS.md`
- `docs/DEPLOYMENT.md`
- `docs/OPERATIONS_MATRIX.md`
- `docs/SECURITY_PRIVACY.md`
- `docs/RUNBOOKS/*`
- `.agents/skills/*/SKILL.md`

## Guardrails nao negociaveis

- Offline-first: fluxos criticos nao podem depender de internet.
- Nao copiar UI, copy, assets, icones, nomes ou referencias de terceiros.
- Nao usar PII real em logs, fixtures, exemplos, seeds ou evidencias.
- Toda regra critica deve ser auditavel.
- Preferir mudanca minima e concentrar regra no dominio correto.
- Se a mudanca alterar comportamento, atualizar docs e exemplos correspondentes.

## Como escolher skills

As skills do repo ficam em `.agents/skills/`. Use uma skill principal por tarefa. Adicione uma skill secundaria apenas quando a mudanca cruzar claramente fronteiras de responsabilidade.

### `comanda-flow-engine`

Use para:

- ciclo de vida da comanda
- transicoes de estado
- split, desconto, cancelamento e checkout
- invariantes operacionais e auditoria da comanda

Nao use para:

- UI pura
- migrations ou schema
- spool ou driver de impressao
- fiscal

### `database-designer`

Use para:

- schema SQLite
- migrations `up.sql` e `down.sql`
- indices, integridade, compatibilidade e rollback

Nao use para:

- UX
- regra de negocio sem mudanca de persistencia

### `pdv-ui-builder`

Use para:

- telas do PDV
- atalhos de teclado
- estados visuais, foco e acessibilidade pragmatica
- densidade e produtividade operacional

Nao use para:

- regra de dominio
- migrations

### `kitchen-router`

Use para:

- envio para producao
- spool persistente
- roteamento por setor
- reimpressao e recuperacao de falhas de impressora

Nao use para:

- layout de tela
- regra geral da comanda

### `cash-control-engine`

Use para:

- abertura e fechamento de caixa
- sangria, suprimento, estorno e divergencia
- conferencia por forma de pagamento e auditoria

Nao use para:

- UI pura

### `fiscal-nfce`

Use para:

- fila fiscal
- NFC-e
- contingencia
- transmissao posterior
- rejeicoes e retentativas

Nao use para:

- UI
- regra geral de comanda sem impacto fiscal

Observacao:

- Esta skill e de altissimo risco. Nao inventar regra fiscal. Exigir validacao humana quando houver duvida.

### `electron-installer`

Use para:

- build Electron
- instalador
- first-run
- logs de campo
- packaging e release

Nao use para:

- dominio de comanda
- UI do renderer

### `qa-regression-pdv`

Use para:

- matriz de regressao
- testes Jest
- UAT
- smoke offline
- release report

Nao use para:

- fiscal como dominio principal
- migrations como dominio principal

## Combinacoes recomendadas

- Regra de comanda com impacto em banco: `database-designer` -> `comanda-flow-engine` -> `qa-regression-pdv`
- Regra de comanda com impacto visual: `comanda-flow-engine` -> `pdv-ui-builder` -> `qa-regression-pdv`
- Impressao com efeito em fluxo operacional: `kitchen-router` -> `comanda-flow-engine` -> `qa-regression-pdv`
- Caixa com persistencia: `cash-control-engine` -> `database-designer` -> `qa-regression-pdv`
- Fiscal com dados ou fila persistente: `fiscal-nfce` -> `database-designer` -> `qa-regression-pdv`
- Release desktop: `electron-installer` -> `qa-regression-pdv`

## Definition of done

Ao concluir uma tarefa, entregue no minimo:

- resumo objetivo do que mudou
- arquivos alterados
- testes ou validacoes executadas
- riscos restantes ou pontos que exigem decisao humana

Quando aplicavel, rode os scripts das skills em `.agents/skills/*/scripts/`.

## Atualizacao de documentacao

Sempre atualizar a documentacao afetada:

- dominio e arquitetura para mudancas de regra
- runbooks para mudancas operacionais
- seguranca e privacidade para dados pessoais, logs e exportacao
- exemplos das skills quando fixtures, estados ou mensagens mudarem

## Evite

- assumir comandos de build ou test que ainda nao existem no repo
- criar estrutura tecnica sem necessidade clara do pedido
- espalhar regra de negocio em UI quando ela pertence ao dominio
- esconder warnings de risco operacional, fiscal ou de dados
