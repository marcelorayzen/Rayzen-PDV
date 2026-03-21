# Database Changelog

## 2026-03-11

### 0001_storage_baseline

- adiciona runner de migrations versionadas com `up.sql` e `down.sql`
- cria a base de `audit_events` para rastreabilidade de acoes criticas
- cria `print_jobs` para spool persistente por setor
- cria `fiscal_queue` para a trilha fiscal desacoplada e persistente
- adiciona conexao SQLite central com WAL habilitavel por configuracao

Compatibilidade:

- migration inicial, sem quebra retroativa porque o repositorio nao tinha schema funcional anterior

Rollback:

- aplicar `down.sql` da migration `0001_storage_baseline` remove as tabelas de dominio desta chamada e preserva apenas `schema_migrations`, permitindo reinicializacao limpa do schema base

Validacao de backup/restore:

- o backup deve incluir `rayzen-pdv.sqlite` e, se WAL estiver habilitado durante a coleta, tambem `rayzen-pdv.sqlite-wal` e `rayzen-pdv.sqlite-shm`
- apos restore, executar o smoke offline e validar que `schema_migrations` contem a versao esperada

## 2026-03-12

### 0002_comanda_foundation

- cria `comandas` como raiz persistente do aggregate operacional
- cria `comanda_items` com status `LANCADO`, `ENVIADO` e `CANCELADO`
- cria `comanda_payments` para checkout confirmado
- cria `comanda_precontas` para snapshots auditaveis de pre-conta
- adiciona repositorio transacional para salvar a comanda e seus eventos criticos em conjunto com `audit_events`

Compatibilidade:

- migration aditiva sobre `0001_storage_baseline`, sem alterar tabelas anteriores

Rollback:

- aplicar `down.sql` da migration `0002_comanda_foundation` remove apenas as tabelas da trilha de comanda e preserva a base anterior

### 0003_print_spool_routing

- evolui `print_jobs` para armazenar destino de impressora, tipo de ticket, lease de processamento e referencia de segunda via
- prepara o spool persistente para retries idempotentes e retomada apos falha do processo principal
- viabiliza segunda via como novo job auditavel, sem sobrescrever o job original

Compatibilidade:

- migration aditiva sobre o baseline existente; dados antigos de `print_jobs` sao preservados e assumem `ticket_kind = 'PRODUCAO'`

Rollback:

- aplicar `down.sql` da migration `0003_print_spool_routing` recria `print_jobs` no formato anterior e descarta apenas os metadados extras de roteamento e lease

Validacao de backup/restore:

- o backup operacional continua incluindo `rayzen-pdv.sqlite` e sidecars do WAL, quando presentes
- apos restore, validar `schema_migrations`, listar `print_jobs` pendentes e conferir que a pasta `%ProgramData%\\RayzenPDV\\spool\\` pode ser recriada localmente sem bloquear a fila persistida

### 0004_cash_control_foundation

- cria `cash_sessions` para abertura, fechamento e conferencia da sessao de caixa local
- cria `cash_movements` para recebimentos, sangrias e suprimentos por forma de pagamento
- adiciona repositorio transacional de caixa com persistencia da sessao, movimentos e eventos em `audit_events`

Compatibilidade:

- migration aditiva sobre a base existente, sem alterar tabelas anteriores

Rollback:

- aplicar `down.sql` da migration `0004_cash_control_foundation` remove apenas as tabelas de caixa e preserva comandas, spool, fila fiscal e auditoria existente

### 0005_fiscal_sp_foundation

- cria `fiscal_emitters` para configuracao por emitente no escopo inicial de Sao Paulo
- cria `fiscal_documents` e `fiscal_document_events` para rastrear estados e eventos da NFC-e 65
- recria `fiscal_queue` com emitente, ambiente, modelo, lease de processamento e referencias do documento
- prepara a trilha local para provider `NS_TECNOLOGIA`, preservando a fila persistente anterior

Compatibilidade:

- migration aditiva para a trilha fiscal; registros antigos de `fiscal_queue` sao preservados e migrados para um emitente legado de bootstrap

Rollback:

- aplicar `down.sql` da migration `0005_fiscal_sp_foundation` recria `fiscal_queue` no formato anterior e remove as tabelas novas de emitente, documento e evento fiscal

Validacao de backup/restore:

- o backup deve incluir `rayzen-pdv.sqlite`, sidecars do WAL quando presentes e a arvore `%ProgramData%\\RayzenPDV\\fiscal\\xml\\`
- os segredos fiscais protegidos por DPAPI devem ser tratados fora do backup operacional comum ou em pacote cifrado separado, conforme a politica de seguranca

### 0006_fiscal_contingency

- evolui `fiscal_documents` e `fiscal_queue` para carregar modo de emissao, inicio da contingencia, DANFE local e ultima consulta de situacao
- prepara a trilha de contingencia offline com `tpEmis=9`, `dhCont`, `xJust`, reenvio posterior e consulta por chave
- preserva a fila fiscal persistente e os documentos anteriores de forma aditiva

Compatibilidade:

- migration aditiva sobre `0005_fiscal_sp_foundation`, sem remover tabelas nem descartar registros existentes

Rollback:

- aplicar `down.sql` da migration `0006_fiscal_contingency` recria `fiscal_documents` e `fiscal_queue` no formato anterior, descartando apenas os metadados novos de contingencia

Validacao de backup/restore:

- o backup deve incluir `rayzen-pdv.sqlite`, sidecars do WAL quando presentes, `%ProgramData%\\RayzenPDV\\fiscal\\xml\\` e `%ProgramData%\\RayzenPDV\\fiscal\\danfe\\`
- os segredos fiscais em `%ProgramData%\\RayzenPDV\\fiscal\\secrets\\` continuam fora do backup operacional comum ou em pacote cifrado separado
