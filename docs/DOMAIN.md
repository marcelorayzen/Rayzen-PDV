# Dominio - Rayzen PDV

Este documento consolida o modelo mental atual do produto: entidades, invariantes, eventos e regras-chave de comanda, caixa, impressao e fiscal.

## Termos

- **Comanda**: conta aberta vinculada a mesa, cliente ou atendimento.
- **Sessao de caixa**: janela operacional de abertura, operacao e fechamento.
- **Setor**: destino de producao, como cozinha ou bar.
- **Evento**: registro imutavel de uma acao critica para auditoria.

## Entidades principais

### Operador

Baseline atual do produto:

- autenticacao local por operador
- PIN por operador no MVP
- papeis operacionais `CAIXA`, `GARCOM` e `GERENTE`
- persistencia local em `operators` com sessao ativa em `operator_sessions`

Campos persistidos no baseline atual:

- `operator_id`
- `operator_code`
- `nome`
- `pin_hash`
- `role`
- `ativo`
- `created_at`
- `updated_at`

Sessao local:

- `terminal_id`
- `operator_id`
- `login_at`
- `created_at`
- `updated_at`

No baseline atual, o PIN nunca e persistido em claro. O login acontece em `renderer -> IPC -> electron -> packages/db`.

First-run:

- seed inicial cria `ADMIN` com role `GERENTE` e PIN inicial `1234`
- o seed so roda quando `operators` e `products` estao vazios

### Terminal

Representa o posto operacional que executa o app desktop.

Campos tecnicos recorrentes no baseline atual:

- `terminalId`
- `label`
- configuracao local ligada ao emitente e aos paths operacionais

### Comanda

Campos relevantes no aggregate e na persistencia:

- `comandaId`
- `numero`
- `mesaId?`
- `status`
- `openedAt`
- `closedAt?`
- `cancelledAt?`
- `cancellationReason?`
- `currentOwnerUserId?`

Status canonicos:

- `ABERTA`
- `EM_PRODUCAO`
- `EM_PAGAMENTO`
- `ENCERRADA`
- `CANCELADA`

### Itens da comanda

Campos relevantes:

- `itemId`
- `comandaId`
- `produtoId`
- `productLabel`
- `setor`
- `quantity`
- `unitPriceCents`
- `status`
- `note?`
- `productionBatchId?`
- `cancellationReason?`

Status atuais:

- `LANCADO`
- `ENVIADO`
- `CANCELADO`

### Produto

Campos persistidos no baseline atual:

- `product_id`
- `nome`
- `preco_cents`
- `categoria`
- `setor`
- `shortcut_hint`
- `ativo`
- `created_at`
- `updated_at`

O catalogo operacional do shell agora vem de `products` via IPC, sem fixture em memoria no renderer.

### Pagamento

Campos relevantes:

- `paymentId`
- `comandaId`
- `method`
- `amountCents`
- `changeAmountCents`
- `paidAt`

No baseline atual, o fechamento valido da comanda depende de total consistente e regra de troco compativel com pagamento em dinheiro.

### Sessao de caixa

Campos relevantes:

- `cashSessionId`
- `terminalId`
- `openedByUserId`
- `openedAt`
- `openingFundAmountCents`
- `status`
- `closingStartedAt?`
- `closedAt?`
- `divergenceReason?`
- `closureSummary?`

Status atuais:

- `ABERTO`
- `FECHAMENTO`
- `FECHADO`

### Movimento de caixa

Campos relevantes:

- `cashMovementId`
- `cashSessionId`
- `movementType`
- `paymentMethod`
- `amountCents`
- `reason`
- `sourceEntity?`
- `sourceEntityId?`
- `occurredAt`

Tipos atuais:

- `RECEBIMENTO`
- `SANGRIA`
- `SUPRIMENTO`

### Impressao

Campos relevantes:

- `printJobId`
- `sourceEntity`
- `sourceEntityId`
- `setor`
- `ticketKind`
- `status`
- `dedupKey`
- `printerTargetName?`
- `attempts`
- `lastErrorCode?`
- `nextRetryAt?`
- `secondCopyOfJobId?`

Roteamento persistido atual:

- `print_sector_routing.setor`
- `print_sector_routing.printer_name`

Status atuais:

- `QUEUED`
- `PRINTING`
- `WAITING_PRINTER`
- `NEEDS_ATTENTION`
- `DONE`

Tipos de ticket atuais:

- `PRODUCAO`
- `SEGUNDA_VIA`

### Fiscal

Escopo fiscal atual:

- Sao Paulo
- NFC-e modelo `65`
- provider `NS_TECNOLOGIA`
- certificado baseline `e-CNPJ A1`

Entidades locais:

- `fiscal_emitters`
- `fiscal_documents`
- `fiscal_document_events`
- `fiscal_queue`

Estados atuais:

- `DRAFT`
- `SIGNED`
- `SENT`
- `AUTHORIZED`
- `CONTINGENCY`
- `REJECTED`

Modos de emissao atuais:

- `NORMAL`
- `CONTINGENCY_OFFLINE`

## Invariantes

### Comanda

- comanda `ENCERRADA` ou `CANCELADA` nao recebe novos itens
- item `ENVIADO` nao pode ser apagado; apenas cancelado com evento e motivo
- cancelamentos exigem motivo e ator registrados
- pre-conta gera snapshot auditavel do total
- checkout encerra a comanda apenas com total valido
- troco acima do total so e permitido quando houver pagamento em `DINHEIRO` suficiente

### Caixa

- abertura registra fundo inicial e contexto do turno
- fechamento precisa ser auditavel
- divergencia nao pode ser ocultada; precisa ficar explicita com justificativa
- sangria exige motivo e nao pode exceder o esperado em dinheiro
- suprimento exige motivo
- fechamento exige zero comandas pendentes em `EM_PAGAMENTO` no fluxo de dominio correspondente

### Impressao

- falha de impressora nao bloqueia venda
- jobs precisam sobreviver a falhas do processo
- reprocessamento deve ser idempotente
- reimpressao gera segunda via explicita, sem sobrescrever o job original

### Fiscal

- nao inventar regra fiscal fora do escopo homologado
- Sao Paulo usa NFC-e como documento-alvo de consumidor; CF-e-SAT nao entra como fluxo novo principal
- provider fiscal entra por adaptador
- fila fiscal precisa sobreviver a crash e permitir retentativa posterior
- segredos do emitente ficam segregados por emitente e fora do banco
- certificado A1, senha e CSC nao podem ficar em claro no disco local
- contingencia preserva `tpEmis=9`, `dhCont`, `xJust`, DANFE local e transmissao posterior

## Eventos de auditoria

### Estrutura atual

Campos recorrentes em `audit_events`:

- `eventId`
- `entity`
- `entityId`
- `action`
- `actorUserId?`
- `actorTerminalId?`
- `actorRole?`
- `occurredAt`
- `payload`

Eventos fiscais tambem possuem trilha dedicada em `fiscal_document_events`.

Exemplos:

```json
{"eventId":"evt_100","entity":"COMANDA","entityId":"cmd_1","action":"COMANDA_ABERTA","actorUserId":"usr_1","actorTerminalId":"t_1","occurredAt":"2026-03-10T10:00:00-03:00","payload":{"numero":"101","mesaId":"M12"}}
{"eventId":"evt_110","entity":"ITEM","entityId":"it_1","action":"ITEM_ENVIADO_PRODUCAO","actorUserId":"usr_1","actorTerminalId":"t_1","occurredAt":"2026-03-10T10:03:00-03:00","payload":{"setor":"COZINHA"}}
```

## Regras operacionais

### Enviar para producao

- ao confirmar envio, o sistema cria jobs por setor
- a criacao do job nasce do fluxo persistido de `sendComandaToProduction`, nao da UI
- a operacao e idempotente para evitar impressao duplicada em retries

### Reimpressao

- segunda via exige novo job no spool, vinculado ao job original
- o ticket carrega marcador explicito de segunda via
- a solicitacao deixa trilha auditavel local
- jobs em `NEEDS_ATTENTION` podem ser reprocessados manualmente sem recriar a comanda

### Pre-conta e checkout

- pre-conta congela uma visao auditavel do total
- checkout encerra comanda e atualiza valores de pagamento
- checkout confirmado pode enfileirar a NFC-e vinculada a `COMANDA` quando houver emitente fiscal habilitado e segredos locais disponiveis
- o baseline atual ja fecha o roundtrip de abertura, lancamento, cancelamento de item, envio para producao, pre-conta e confirmacao de pagamento via IPC e persistencia local

### Fluxo de caixa

- recebimentos ficam classificados por forma (`DINHEIRO`, `PIX`, `CARTAO_CREDITO`, `CARTAO_DEBITO`, `OUTRO`)
- sangria e suprimento sao movimentos explicitos e auditaveis
- fechamento entra em estado `FECHAMENTO` antes da conferencia final
- conferencia compara esperado e contado por forma
- divergencia exige justificativa explicita antes de concluir o fechamento
- o baseline atual ja fecha via IPC e SQLite a abertura, recebimento essencial, suprimento, sangria, fechamento e exportacao da auditoria do caixa
- checkout de comanda confirmada gera `MOVIMENTO_CAIXA` persistido com referencia para a comanda
- o main process expone consultas de `status` e `resumo` do caixa sem deslocar a regra para o renderer

### Fluxo fiscal atual

- cada emitente opera com configuracao propria e provider `NS_TECNOLOGIA`
- o checkout da comanda pode originar `fiscal_documents` e `fiscal_queue` automaticamente no processo principal
- a NFC-e nasce em `DRAFT` e pode seguir para `SIGNED`, `SENT`, `AUTHORIZED`, `CONTINGENCY` ou `REJECTED`
- cada transicao fiscal gera evento rastreavel e preservado localmente
- XML autorizado permanece guardado localmente com vinculo ao emitente e ao documento
- ao entrar em contingencia, o documento preserva `tpEmis=9`, `dhCont` e `xJust`, gera DANFE local e permite consulta posterior por chave
- o renderer nao emite nota nem consulta banco diretamente; ele consome o estado fiscal por IPC

### Cancelamentos

- exigem motivo
- exigem ator registrado
- cancelamento de comanda com pagamento confirmado continua fora do baseline atual

## Guardrails legais e de IP

- design e copy devem ser originais do Rayzen PDV
- o repositorio nao deve manter referencias a concorrentes em texto, imagens, nomes de tela ou assets
- consulte tambem [SECURITY_PRIVACY.md](SECURITY_PRIVACY.md)
