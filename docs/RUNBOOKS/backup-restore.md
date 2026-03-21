# Runbook - Backup e Restore (Rayzen PDV)

## Objetivo

Garantir recuperacao rapida em caso de falha, corrupcao ou troca de equipamento.

## Escopo minimo de backup

- Arquivo SQLite do Rayzen PDV.
- Sidecars `-wal` e `-shm` do SQLite quando existirem.
- `config/runtime-config.json` com snapshot operacional sem segredos protegidos.
- Spool e filas de impressao e fiscal, se estiverem fora do banco.
- Configuracao local de impressoras, setores e perfis, se armazenada separadamente.
- XML e eventos fiscais, quando armazenados fora do banco.
- Export de logs para analise de incidente, quando necessario.
- Nunca incluir `%ProgramData%\\RayzenPDV\\fiscal\\secrets\\` no pacote de backup.

## Frequencia

- Backup operacional minimo diario.
- Para trilha fiscal, garantir que a guarda local e exportavel preserve XML e eventos pelo prazo definido de retencao.

## Procedimento de backup

1. Escolher um destino absoluto para o backup ou usar `%ProgramData%\\RayzenPDV\\backups\\`.
2. Executar o fluxo interno de backup do Rayzen PDV via suporte operacional do app para gerar um diretorio `rayzen-pdv-backup-*` com `backup-manifest.json`.
3. Confirmar que o manifesto lista banco, sidecars SQLite existentes, `CONFIG_EXPORT`, spool, XML, DANFE e eventos fiscais fora do banco quando existirem.
4. Se o incidente exigir suporte, gerar tambem a exportacao de logs redigidos localmente.
5. Proteger o backup com controle de acesso e, idealmente, criptografia.
6. Registrar data, hora e versao do Rayzen PDV.

Fluxos IPC atuais:

- `backup.criar()`
- `backup.listar()`
- `backup.restaurar()`

## Procedimento de restore

1. Instalar o Rayzen PDV.
2. Parar o aplicativo antes do restore.
3. Selecionar um diretorio de backup valido contendo `backup-manifest.json`.
4. Executar o fluxo interno de restore; o Rayzen valida manifesto, presenca dos artefatos e `PRAGMA integrity_check` do SQLite antes de concluir.
5. Confirmar que o restore retornou `integrityCheck: "ok"` e `requiresRestart: true`.
6. Reiniciar o aplicativo apos o restore.
7. Executar smoke test offline.
8. Validar impressao, caixa e presenca dos anexos fiscais esperados.
9. Confirmar que a versao esperada aparece em `schema_migrations`.

## Recuperacao de desastre

1. Identificar o backup mais recente em `backup.listar()`.
2. Verificar se o pacote esta `restorable`.
3. Restaurar o backup escolhido.
4. Reiniciar obrigatoriamente o aplicativo.
5. Rodar smoke offline, spool, caixa e fiscal.
6. Registrar a ocorrencia com logs exportados e o manifesto do backup restaurado.

## Evidencias

- Registro de backup e restore com data, hora e versao.
- `backup-manifest.json` do pacote restaurado.
- Resultado do smoke test.
- Relatorio de homolog ou piloto em `docs/qa/`, quando o restore fizer parte de uma promocao de release.
