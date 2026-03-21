# Arquitetura - Rayzen PDV

## Principios arquiteturais

### Offline-first

- fluxos criticos nao podem depender de internet
- o terminal precisa continuar vendendo, imprimindo e registrando auditoria mesmo com conectividade instavel
- integracoes externas entram como fila, retentativa ou sincronizacao posterior

### Local-first e tolerancia a falhas

- persistencia local em SQLite com migrations versionadas
- reprocessamento idempotente para spool de impressao e fila fiscal
- paths operacionais em `%ProgramData%\\RayzenPDV\\`
- logs e bundles de suporte exportaveis sem PII desnecessaria

### Separacao de responsabilidade

- `apps/pdv` concentra shell operacional, navegacao, foco e composicao de casos de uso locais
- `electron` concentra IPC, filesystem, impressao, backup/restore, seguranca local e packaging
- `packages/db` concentra schema, migrations, conexao SQLite, transacoes e repositorios
- `packages/ui` concentra tokens e utilitarios visuais compartilhados

## Componentes

### `apps/pdv`

O renderer atual entrega:

- shell desktop teclado-first sem API HTTP local
- autenticacao local por PIN no baseline do shell
- sessao de operador persistida em SQLite e resolvida via IPC no processo principal
- catalogo operacional persistido em SQLite e carregado via IPC
- navegacao principal por atalhos canonicos
- interface operacional de comanda com abertura, lancamento de itens, cancelamento, envio para producao, pre-conta e checkout
- interface operacional de caixa com abertura, recebimento por forma, sangria, suprimento, fechamento e divergencia explicita

Separacao interna atual:

- `domain`: regras locais de comanda, caixa, navegacao e estado do shell
- `application`: controllers e orquestracao do renderer
- `infra`: bridge para o preload do Electron e adaptadores locais
- `ui`: renderizacao HTML/CSS/DOM e foco operacional

Integracao atual:

- o shell de `comanda` e `caixa` ja consome IPC real para abrir comanda, lancar item, cancelar item, enviar producao, iniciar checkout, confirmar pagamento, abrir caixa, registrar movimento essencial, fechar caixa e exportar auditoria
- o processo principal tambem expone `cash.status` e `cash.resumo` como leitura explicita do caixa persistido do terminal
- o processo principal expone `fiscal.getDocumentStatus`, `fiscal.listPending`, `fiscal.reprocess` e `fiscal.queryStatusByAccessKey` para a trilha fiscal operacional
- o `main process` executa as regras de dominio, persiste no SQLite e devolve snapshots operacionais para o renderer
- o spool de impressao de producao passa a nascer do fluxo persistido de envio para producao, e nao de uma acao isolada da UI
- o renderer nao imprime nem cria job diretamente; ele so consome snapshots e comandos expostos via IPC

### `electron`

O processo principal atual entrega:

- `BrowserWindow` com preload seguro e `contextIsolation`
- bridge `window.rayzenDesktop` como caminho padrao entre renderer e main process
- resolucao de paths operacionais em `%ProgramData%\\RayzenPDV\\`
- configuracao operacional persistida em `%ProgramData%\\RayzenPDV\\config\\runtime-config.json`
- logs locais exportaveis com redaction de chaves sensiveis e padroes comuns de PII
- suporte operacional para backup e restore controlados, com listagem local de pacotes, manifesto e validacao de integridade do SQLite
- wizard de first-run guiado pelo renderer, validado no processo principal e persistido fora dos segredos fiscais
- spool persistente de impressao por setor, segunda via e retries idempotentes
- worker local de spool com retentativa automatica ate 3 vezes e reprocessamento manual por IPC
- trilha fiscal SP com emitente, fila persistente, contingencia `tpEmis=9`, consulta por chave e segredos protegidos via `safeStorage`
- worker fiscal local para consumir `fiscal_queue`, tentar emissao via `NS_TECNOLOGIA` e reprocessar pendencias sem depender da UI
- packaging Windows com Electron Forge e rollout manual sem auto-update

Nao existe API HTTP local no baseline atual. Toda comunicacao interna do app desktop continua em IPC.

### `packages/db`

`packages/db` entrega a camada local de persistencia:

- conexao central com SQLite local
- migrations `up.sql` e `down.sql`
- `schema_migrations` para controle de versao
- `operators`, `operator_sessions` e `products` para autenticacao local, sessao e catalogo operacional
- `audit_events` para trilha imutavel de eventos criticos
- `print_jobs` para spool persistente
- `print_sector_routing` para amarrar setor a impressora do Windows no terminal
- `cash_sessions` e `cash_movements` para caixa
- `fiscal_emitters`, `fiscal_documents`, `fiscal_document_events` e `fiscal_queue` para a trilha fiscal inicial
- tabelas da comanda e repositorios transacionais do dominio ja modelado

First-run atual:

- o `main process` roda seed inicial somente quando `operators` ou `products` estao vazios
- o seed cria `ADMIN` com role `GERENTE` e PIN inicial `1234`
- o seed publica quatro produtos operacionais minimos para abrir a operacao sem depender de fixture em memoria
- o seed publica rotas locais `COZINHA`, `BAR` e `CAIXA` para impressoras padrao do terminal
- o wizard de first-run conclui empresa local e sobrescreve as rotas de impressao do terminal quando necessario

O baseline continua preparado para WAL habilitavel e backup local consistente, inclusive com sidecars do SQLite quando existirem.

### `packages/ui`

O pacote de UI ainda e pequeno, mas ja cumpre o papel de concentrar utilitarios e tokens compartilhados do visual do produto. O renderer do `apps/pdv` ainda carrega parte relevante do shell diretamente.

## Fluxos principais

### Comanda

1. abrir comanda
2. lancar itens
3. cancelar item ou comanda com motivo quando permitido
4. enviar para producao
5. gerar pre-conta
6. realizar checkout
7. enfileirar NFC-e do checkout quando houver emitente fiscal habilitado
7. encerrar a comanda

### Impressao

1. o dominio gera a intencao operacional
2. o sistema cria jobs por setor em spool persistente
3. o servico do Electron faz claim, renderiza o ticket e tenta imprimir
4. falha de impressora nao bloqueia a venda
5. o job segue em retry local ate 3 tentativas ou pede intervencao humana
6. segunda via cria novo job rastreavel

### Caixa

1. abrir sessao local
2. registrar recebimentos por forma
3. registrar sangria e suprimento
4. fechar com conferencia
5. persistir divergencia explicita e trilha de auditoria

### Fiscal SP

1. preparar documento e enfileirar emissao
2. checkout confirmado pode originar automaticamente a NFC-e da comanda
3. o worker fiscal local assina e envia ao provider `NS_TECNOLOGIA` quando houver conectividade
4. em contingencia, registrar `tpEmis=9`, `dhCont` e `xJust`
5. gerar DANFE local e reter XML/eventos fiscais
6. reenviar ou consultar situacao posteriormente pela chave

## Persistencia e paths locais

Baseline atual de paths no Windows:

- banco: `%ProgramData%\\RayzenPDV\\data\\rayzen-pdv.sqlite`
- config operacional: `%ProgramData%\\RayzenPDV\\config\\runtime-config.json`
- logs: `%ProgramData%\\RayzenPDV\\logs\\`
- backups: `%ProgramData%\\RayzenPDV\\backups\\`
- spool: `%ProgramData%\\RayzenPDV\\spool\\`
- XML fiscal: `%ProgramData%\\RayzenPDV\\fiscal\\xml\\`
- DANFE de contingencia: `%ProgramData%\\RayzenPDV\\fiscal\\danfe\\`
- eventos fiscais fora do banco: `%ProgramData%\\RayzenPDV\\fiscal\\events\\`
- segredos fiscais: `%ProgramData%\\RayzenPDV\\fiscal\\secrets\\`

## Observabilidade e suporte

O baseline atual inclui:

- `main.log` local no processo principal
- exportacao de logs redigidos para suporte
- bundles de backup com manifesto
- restore controlado com reinicio obrigatorio do app
- auditoria em banco para eventos criticos de comanda, caixa, impressao e fiscal

## Packaging e rollout

O baseline de release para Windows usa Electron Forge:

- staging do app em `electron/builders/app-package/`
- `pnpm make:win` para ZIP local
- `pnpm make:installer:win` para tentativa de instalador Squirrel
- `pnpm release:manual` para consolidar release versionada em `electron/out/releases/vX.Y.Z/windows/`, sempre com ZIP de fallback
- `manual-rollout-manifest.json` com checksum e metadados de artefatos
- auto-update desabilitado

## Pontos abertos reais

- ampliar o roundtrip persistido para configuracoes locais que ainda nao estao modeladas em banco, como preferencias operacionais e parametrizacao de terminal
- homologar matriz de impressoras termicas por modelo
- homologar em campo a trilha fiscal com `NS_TECNOLOGIA`
- concluir estrategia de sincronizacao eventual, se ela entrar no escopo do produto
- homologar e assinar o fluxo de instalador Windows antes de promover para `prod`
