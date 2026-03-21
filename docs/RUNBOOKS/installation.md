# Runbook - Instalacao (Rayzen PDV)

## Objetivo

Instalar o Rayzen PDV e validar a operacao minima offline.

Para pendencias reais de homologacao, arquivos de rollout, passo a passo consolidado de campo e criterios de aceite, usar tambem `docs/RUNBOOKS/homologation-installation.md`.

## Pre-requisitos

- Sistema operacional suportado: Windows 10/11 x64
- Hardware minimo: CPU 4 cores, 8 GB de RAM, SSD 256 GB, resolucao 1366x768
- Teclado fisico obrigatorio para operacao
- Internet opcional para operacao; recomendada para suporte e retentativas
- Impressoras suportadas no MVP: termicas de diversas marcas com baseline inicial via driver do Windows
- Conexao de impressora suportada no baseline: USB ou Ethernet

## Instalacao

Artefatos de rollout manual esperados:

- pasta versionada em `electron/out/releases/vX.Y.Z/windows/`
- `manual-rollout-manifest.json` com hashes e lista de artefatos
- ZIP local aprovado para o ambiente
- instalador Windows quando o maker Squirrel completar no host de release

O MVP nao usa auto-update. Toda promocao continua manual e deve apontar para uma versao fechada.

1. Separar a pasta versionada aprovada do release manual e validar o `manual-rollout-manifest.json`.
2. Extrair o ZIP operacional correspondente a essa versao ou executar o instalador aprovado quando ele fizer parte do rollout.
3. Abrir o aplicativo.
4. Concluir o wizard de first-run local.
   O wizard valida:
   `ADMIN / 1234` no seed
   empresa local
   impressoras de `COZINHA`, `BAR` e `CAIXA`
   persistencia em `%ProgramData%\\RayzenPDV\\config\\runtime-config.json`
5. Configurar impressoras por setor quando o wizard precisar sobrescrever o baseline.
   Baseline inicial no banco:
   `COZINHA -> IMP_COZINHA_01`
   `BAR -> IMP_BAR_01`
   `CAIXA -> IMP_CAIXA_01`
6. Verificar diretorios de dados, config, banco e logs em `%ProgramData%\\RayzenPDV\\`.
7. Validar que o spool local existe em `%ProgramData%\\RayzenPDV\\spool\\`.
8. Validar que os diretorios fiscais locais existem quando o terminal operar NFC-e:
   `%ProgramData%\\RayzenPDV\\fiscal\\xml\\`
   `%ProgramData%\\RayzenPDV\\fiscal\\danfe\\`
   `%ProgramData%\\RayzenPDV\\fiscal\\secrets\\`
9. Registrar versao instalada, `sha256` do artefato aplicado e identificar o terminal para suporte futuro.

## Smoke test offline

Referencia automatizada: `docs/qa/smoke-offline.md`
Referencia automatizada de instalacao e reinicio: `pnpm test:smoke:install`

1. Desconectar a internet.
2. Abrir o shell do Rayzen PDV e validar o wizard de first-run quando o terminal estiver vazio.
3. Concluir o first-run e validar a tela de PIN local.
4. Entrar com um operador local de teste do ambiente e navegar pelos atalhos `F2`, `F3`, `F4`, `F6`, `F7` e `F8`.
5. Abrir comanda.
6. Lancar item.
7. Enviar para producao.
8. Confirmar que o job entra no spool e que a impressora do setor recebe o ticket.
9. Simular indisponibilidade da impressora e validar que a venda segue e o job entra em retry local ate `NEEDS_ATTENTION` quando exceder o limite automatico.
10. Reprocessar manualmente o job ou emitir uma segunda via controlada.
11. Gerar pre-conta.
12. Realizar checkout ou pagamento.
13. Abrir e fechar caixa.
14. Reiniciar o aplicativo e validar persistencia de configuracao, caixa e comanda local quando aplicavel.
15. Confirmar que `manual-rollout-manifest.json` e a versao instalada batem com o release aprovado.

## Atualizacao

1. Gerar o pacote com `pnpm release:manual`.
2. Validar `manual-rollout-manifest.json`.
3. Aplicar o instalador aprovado ou reextrair o ZIP novo sobre uma pasta limpa.
4. Preservar `%ProgramData%\\RayzenPDV\\` entre versoes.
5. Executar `pnpm test:smoke:install` no ambiente de homolog e o smoke offline manual no terminal de campo.

## Rollback

1. Suspender a distribuicao da versao atual.
2. Reinstalar o ultimo instalador aprovado ou reextrair o ultimo ZIP aprovado.
3. Restaurar backup valido se houver regressao de dados.
4. Reiniciar o aplicativo.
5. Reexecutar o smoke minimo de instalacao e operacao offline.

## Evidencias para suporte

- Versao instalada.
- Sistema operacional e especificacoes basicas.
- Modelo e tipo de conexao das impressoras configuradas.
- Logs exportados conforme o runbook de troubleshooting.
