# Seguranca e Privacidade - Rayzen PDV

> Este documento define padroes minimos de protecao de dados e hardening. Itens ainda indefinidos devem ser fechados pela engenharia e, quando necessario, por seguranca e compliance.

## Objetivo

- Minimizar risco de vazamento de dados.
- Reduzir exposicao de PII em logs, backups e suporte.
- Garantir rastreabilidade sem violar privacidade.

## Principios LGPD

- Minimizacao: coletar apenas o necessario.
- Finalidade: usar dados para objetivos explicitos do PDV.
- Seguranca: proteger dados em repouso e em transito quando houver.
- Prestacao de contas: manter auditoria e evidencias.

## PII neste contexto

Exemplos nao exaustivos:

- nome, telefone, CPF e e-mail de cliente
- identificadores de funcionario quando vinculados a uma pessoa
- qualquer dado que identifique direta ou indiretamente o titular

## Regras para dados pessoais

- Evitar armazenar CPF e telefone se nao houver necessidade real de produto ou compliance.
- Se armazenar PII, proteger com controles tecnicos e de acesso.
- Nunca incluir PII em mensagens de erro, telemetria ou logs operacionais.

Baseline de criptografia em repouso no Windows:

- certificado A1, senha do certificado e CSC devem ser protegidos com Windows DPAPI no terminal
- DANFE de contingencia e XML devem ficar em diretorios fiscais locais segregados por emitente, com controle de acesso do terminal
- backups contendo segredos fiscais devem ser cifrados separadamente do backup operacional comum
- criptografia de disco do sistema operacional e recomendada para equipamentos de campo

## Logging policy

### Niveis de log

- `debug` em desenvolvimento
- `info`, `warn` e `error` em producao

### Conteudo permitido

- IDs tecnicos, como `comandaId`, `eventId` e `terminalId`
- `cashSessionId`, `cashMovementId` e codigos de forma de pagamento
- `fiscalDocId`, `emitterId`, chave de acesso e codigos tecnicos de retorno
- `tpEmis`, `dhCont` e codigos tecnicos de contingencia fiscal
- status operacionais
- codigos de erro
- tempos e latencias
- `printJobId`, `setor` e identificadores tecnicos de impressora

### Conteudo proibido

- CPF, telefone, nome de cliente ou outros dados pessoais
- payload fiscal completo se contiver PII
- segredos, tokens, chaves ou certificados
- conteudo de ticket com PII desnecessaria em logs ou evidencias abertas

## Backups e retencao

- Backups devem ser protegidos por controle de acesso e, idealmente, criptografia.
- Retencao inicial de logs locais: 30 dias.
- Frequencia minima de backup operacional: diaria.
- Retencao fiscal baseline: manter XML e eventos fiscais por no minimo 132 meses contados da autorizacao do documento.
- Ao exportar logs para suporte, aplicar redaction de PII por chave sensivel e por padroes comuns como CPF, e-mail e telefone.
- Bundles de auditoria do caixa devem conter apenas IDs tecnicos, valores, diferencas e justificativas operacionais, sem PII.
- XML e eventos fiscais autorizados devem seguir a guarda minima definida, com controle de acesso por emitente.

## Hardening local

- Assinatura de codigo: obrigatoria antes da primeira ida para producao, apos piloto aprovado. Provedor final de assinatura ainda depende de decisao operacional.
- Certificado fiscal baseline: e-CNPJ A1. O armazenamento, rotacao e acesso ao certificado devem seguir privilegio minimo e controle operacional por emitente.
- O arquivo do A1 deve permanecer criptografado em repouso e acessivel apenas ao contexto operacional do emitente correspondente.
- No baseline Electron/Windows, a protecao local de certificado, senha e CSC usa `safeStorage`, que delega para DPAPI.
- Senha do certificado e CSC nao devem ser persistidos em log, print, evidencias abertas ou canais informais de suporte.
- Renovacao do A1 deve iniciar 45 dias antes do vencimento e terminar com validacao concluida ate 15 dias antes do vencimento.
- Atualizacoes controladas e canais: rollout manual no MVP, com auto-update desabilitado no estado atual.
- Permissoes minimas de filesystem.
- Caminhos de dados em diretorios apropriados do sistema operacional.

## Guardrails legais e de IP

- Identidade visual e textos devem ser originais do Rayzen PDV.
- Nao reter nomes, sinais distintivos, imagens ou assets de terceiros no repositorio.

## Itens abertos

- Processo de DSR, se aplicavel.
- Definicao de DPO ou encarregado e fluxo de incident response.
