# Runbook - Troubleshooting (Rayzen PDV)

## Objetivo

Permitir diagnostico rapido de problemas comuns em campo.

## Coleta de evidencias

Sempre registrar:

- versao do Rayzen PDV
- sistema operacional e impressoras
- passos para reproduzir
- logs exportados, sem PII quando possivel
- se o incidente ocorreu em homolog ou piloto, anexar tambem o release report correspondente em `docs/qa/`

## Problemas comuns

### PDV nao abre ou fica em tela branca

- Verificar a versao instalada e o artefato aplicado no release manual.
- Coletar `main.log` em `%ProgramData%\\RayzenPDV\\logs\\` ou usar a exportacao local de logs redigidos.
- Verificar tambem `%ProgramData%\\RayzenPDV\\config\\runtime-config.json` para confirmar se o first-run foi concluido.
- Validar se o banco existe em `%ProgramData%\\RayzenPDV\\data\\rayzen-pdv.sqlite`.
- Confirmar se a release usada consta no `manual-rollout-manifest.json` aprovado.
- Se houver corrupcao ou boot inconsistente, considerar restore de backup.

### Impressao nao sai

- Verificar conexao e status da impressora no sistema operacional.
- Verificar spool e jobs pendentes.
- Localizar os jobs pendentes em `%ProgramData%\\RayzenPDV\\spool\\` e no status exposto pelo app.
- Validar se a impressora do setor aparece no Windows com o nome esperado.
- Se o status estiver `WAITING_PRINTER`, manter a venda e aguardar a retentativa local.
- Se o status chegar a `NEEDS_ATTENTION`, verificar papel, cabo, driver ou configuracao do `print_sector_routing` e depois reprocessar o job manualmente.
- Se houver reimpressao, registrar segunda via e evento correspondente.
- Confirmar que a pasta `%ProgramData%\\RayzenPDV\\spool\\` continua acessivel no terminal.

### Operacao offline falha

- Confirmar que o terminal nao depende de API HTTP local; o baseline do app usa IPC.
- Validar caminho do banco e permissoes de filesystem.
- Confirmar que logs, banco e spool estao acessiveis em `%ProgramData%\\RayzenPDV\\`.
- Se o problema tocar fiscal, verificar tambem `%ProgramData%\\RayzenPDV\\fiscal\\xml\\` e `%ProgramData%\\RayzenPDV\\fiscal\\danfe\\`.

### Fiscal em contingencia ou sem retorno

- Verificar se houve entrada em `tpEmis=9` com `dhCont` e `xJust` registrados.
- Confirmar presenca do DANFE local em `%ProgramData%\\RayzenPDV\\fiscal\\danfe\\`.
- Coletar eventos e XML locais quando o incidente tocar a fila fiscal.
- Localizar pendencias em `%ProgramData%\\RayzenPDV\\fiscal\\events\\` e na fila fiscal exposta pelo app.
- Consultar a situacao pela chave de acesso antes de repetir envio manual.
- Nunca exportar certificado, senha do A1 ou CSC em anexos de suporte.

## Escalonamento

Quando escalar para engenharia, anexar:

- logs relevantes
- `backup-manifest.json`, quando o incidente tocar backup ou restore
- path local do banco e da pasta de logs, quando o incidente tocar persistencia ou boot
- `manual-rollout-manifest.json` e identificacao do artefato aplicado, quando o incidente tocar packaging ou instalacao
- versao e hash do commit, se disponivel
- roteiro reproduzivel
