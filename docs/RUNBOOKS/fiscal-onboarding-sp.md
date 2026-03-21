# Runbook - Onboarding Fiscal SP (Rayzen PDV)

> Escopo inicial: Sao Paulo com NFC-e modelo 65, provider fiscal NS Tecnologia e certificado baseline e-CNPJ A1.

## Objetivo

Preparar uma loja para emissao fiscal em Sao Paulo com rastreabilidade minima, reduzindo erro operacional na passagem de homolog para piloto e de piloto para producao.

## Quando usar

- ao iniciar homologacao fiscal da primeira loja em Sao Paulo
- ao preparar piloto com cliente real
- ao trocar emitente, certificado ou credenciais fiscais
- ao restaurar um terminal fiscal apos incidente

## Pre-requisitos

- Rayzen PDV instalado no terminal alvo
- acesso administrativo ao ambiente Windows do terminal
- emitente com e-CNPJ A1 valido
- credenciamento NFC-e ativo em Sao Paulo
- CSC gerado para o emitente no portal fiscal correspondente
- acesso operacional ao ambiente da NS Tecnologia
- internet disponivel para etapas de credenciamento, configuracao e homologacao

## Checklist de onboarding

### 1. Confirmar dados do emitente

- validar CNPJ, razao social e inscricao estadual do emitente
- validar se a loja e o terminal pertencem ao emitente correto
- registrar qual filial ou unidade usara o terminal

### 2. Preparar certificado digital

- confirmar que o certificado recebido e e-CNPJ A1
- validar inicio e fim de vigencia do certificado
- registrar responsavel pela guarda do arquivo e da senha
- armazenar o certificado com controle de acesso minimo por emitente
- armazenar o arquivo com protecao por Windows DPAPI no terminal
- nunca anexar certificado ou senha em ticket, log ou chat operacional

### 3. Credenciar a NFC-e em Sao Paulo

- confirmar credenciamento do emitente para NFC-e
- registrar se o emitente esta em homologacao ou producao
- guardar evidencia do credenciamento para suporte e auditoria

### 4. Gerar e registrar CSC

- gerar ou obter o CSC do emitente no portal fiscal de Sao Paulo
- registrar identificador do CSC e data de geracao
- armazenar o segredo do CSC em local controlado e protegido por Windows DPAPI no terminal
- nunca expor CSC em logs, prints ou evidencias abertas

### 5. Configurar provider fiscal

- criar ou validar cadastro do emitente na NS Tecnologia
- associar o certificado A1 correto ao emitente
- configurar o ambiente fiscal correto para homologacao ou producao
- registrar identificadores tecnicos necessarios para suporte

### 6. Configurar o terminal no Rayzen PDV

- vincular o terminal ao emitente correto
- aplicar configuracao fiscal do provider NS Tecnologia
- configurar a impressora local dedicada ao DANFE de contingencia para o emitente, quando houver
- confirmar que o emitente ficou salvo no banco local e que os segredos foram gravados no storage protegido do terminal
- validar caminhos locais de logs, banco, spool e exportacoes
- validar os caminhos `%ProgramData%\\RayzenPDV\\fiscal\\xml\\`, `%ProgramData%\\RayzenPDV\\fiscal\\danfe\\` e `%ProgramData%\\RayzenPDV\\fiscal\\secrets\\`
- registrar versao instalada do Rayzen PDV no momento do onboarding

### 7. Executar homologacao funcional

- emitir NFC-e de teste no ambiente de homologacao, preferencialmente a partir de um checkout real de comanda
- validar autorizacao, rejeicao controlada e retentativa
- validar contingencia com `tpEmis=9`, `dhCont`, `xJust`, DANFE local e reenvio posterior
- validar que o checkout cria documento em `fiscal_documents`, item em `fiscal_queue` e que o worker local consegue processar ou manter a pendencia sem bloquear a venda
- validar os canais operacionais `fiscal.listPending`, `fiscal.getDocumentStatus`, `fiscal.reprocess` e `fiscal.queryStatusByAccessKey`
- validar exportacao de logs sem PII desnecessaria
- confirmar que XML, chaves e estados fiscais ficam rastreaveis

### 8. Registrar evidencias

- versao do Rayzen PDV
- data e hora do onboarding
- ambiente fiscal utilizado
- identificacao do emitente e do terminal
- resultado dos testes de emissao e contingencia
- responsavel tecnico pela validacao

## Politica de rotacao do certificado

- iniciar renovacao do A1 45 dias antes do vencimento
- concluir troca e validacao ate 15 dias antes do vencimento
- manter registro da antiga e da nova vigencia
- repetir emissao de validacao apos cada troca

## Gates para promover a loja

### Homolog -> pilot

- credenciamento NFC-e confirmado
- CSC configurado e validado
- certificado A1 valido e associado ao emitente correto
- emissao de homologacao autorizada com sucesso
- contingencia validada no fluxo combinado com a NS Tecnologia
- evidencias arquivadas

### Pilot -> prod

- piloto fiscal aprovado sem bloqueio aberto
- configuracao fiscal revisada para producao
- assinatura de codigo aplicada no Rayzen PDV antes da promocao
- runbooks revisados com aprendizado do piloto

## Troca de certificado

Sempre que houver renovacao ou substituicao do A1:

- registrar motivo da troca
- validar novo periodo de vigencia
- atualizar cadastro no provider fiscal
- repetir emissao de validacao em ambiente apropriado
- registrar quem executou a troca e quando

## Politica de retencao fiscal

- manter XML autorizados, XML de contingencia e eventos fiscais por no minimo 132 meses contados da autorizacao
- manter DANFE de contingencia gerado localmente pelo mesmo prazo operacional definido para os artefatos fiscais do emitente
- manter rastreabilidade entre chave, emitente, terminal e status final
- nao depender apenas de download posterior do portal da Sefaz como mecanismo principal de guarda

## Evidencias minimas por incidente fiscal

- versao do Rayzen PDV
- emitente afetado
- terminal afetado
- ambiente fiscal
- status do documento
- ultimo erro retornado
- se havia contingencia ativa
- data e hora local do incidente

## Nao fazer

- nao usar CF-e-SAT como fluxo novo principal em Sao Paulo
- nao operar com certificado sem controle de acesso
- nao registrar senha do certificado ou CSC em log
- nao promover para producao sem evidencias de homologacao

## Pontos que ainda exigem decisao humana

- detalhamento final do fluxo de contingencia homologado com a NS Tecnologia
