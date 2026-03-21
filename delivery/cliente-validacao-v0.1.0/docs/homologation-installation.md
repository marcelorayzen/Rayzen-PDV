# Runbook - Homologacao e Instalacao (Rayzen PDV)

## Objetivo

Concentrar, em um unico documento, o que ainda falta para homologacao do Rayzen PDV e o passo a passo pratico de instalacao para uso controlado em restaurante.

## Status atual do rollout

O baseline atual do Rayzen PDV esta pronto para piloto controlado com:

- rollout manual por ZIP versionado
- `manual-rollout-manifest.json` com `sha256`
- `first-run` guiado no primeiro boot
- seed inicial de operador `ADMIN` e catalogo base
- persistencia local em `%ProgramData%\RayzenPDV\`
- smoke automatizado de instalacao, reinicio, spool, caixa e operacao offline

Artefato validado no estado atual:

- `electron/out/releases/v0.1.0/windows/manual-rollout-manifest.json`
- `electron/out/releases/v0.1.0/windows/rayzen-pdv-v0.1.0-zip-win32-x64-rayzen-pdv-win32-x64-0-1-0.zip`

## O que ainda falta para homologacao

Pendencias reais que ainda exigem validacao externa ou de campo antes de promover para uso mais amplo:

1. Validar o instalador Squirrel em um host onde o maker conclua com sucesso.
   Estado atual:
   o target existe, mas o rollout homologado hoje continua sendo o ZIP com manifesto.
2. Validar instalacao e operacao em maquinas reais com Windows 10 x64 e Windows 11 x64.
3. Homologar impressoras termicas reais do restaurante.
   Validar nome da impressora no Windows, driver, conectividade, papel e reimpressao.
4. Homologar a trilha fiscal com `NS_TECNOLOGIA` e ambiente externo real.
   Inclui emitente, certificado A1, CSC, autorizacao, rejeicao, contingencia e consulta por chave.
5. Executar restore em maquina secundaria e comprovar volta operacional completa.
6. Confirmar checklist de suporte local.
   A equipe deve conseguir localizar banco, logs, backups, spool e pendencias fiscais sem depender da engenharia.

Itens que nao bloqueiam piloto controlado, mas ainda nao caracterizam producao ampla:

- assinatura de codigo
- refinamentos de UX nao criticos
- ampliacao da matriz de impressoras suportadas
- recursos avancados de caixa fora do escopo atual

## Arquivos e caminhos que a implantacao usa

Artefatos de release:

- pasta versionada: `electron/out/releases/vX.Y.Z/windows/`
- manifesto: `electron/out/releases/vX.Y.Z/windows/manual-rollout-manifest.json`
- ZIP operacional: `electron/out/releases/vX.Y.Z/windows/*.zip`
- instalador Windows: opcional nesta fase, quando existir no release aprovado

Arquivos e diretorios operacionais no terminal:

- banco SQLite: `%ProgramData%\RayzenPDV\data\rayzen-pdv.sqlite`
- configuracao inicial: `%ProgramData%\RayzenPDV\config\runtime-config.json`
- logs locais: `%ProgramData%\RayzenPDV\logs\`
- backups locais: `%ProgramData%\RayzenPDV\backups\`
- spool de impressao: `%ProgramData%\RayzenPDV\spool\`
- XML fiscal: `%ProgramData%\RayzenPDV\fiscal\xml\`
- DANFE de contingencia: `%ProgramData%\RayzenPDV\fiscal\danfe\`
- eventos fiscais fora do banco: `%ProgramData%\RayzenPDV\fiscal\events\`
- segredos fiscais protegidos: `%ProgramData%\RayzenPDV\fiscal\secrets\`

Observacao:

- `%ProgramData%\RayzenPDV\fiscal\secrets\` nao entra no backup operacional comum.

## Passo a passo de instalacao

### 1. Separar o pacote aprovado

1. Localizar a pasta de release aprovada em `electron/out/releases/vX.Y.Z/windows/`.
2. Conferir `manual-rollout-manifest.json`.
3. Confirmar que o `sha256` do ZIP operacional bate com o manifesto.
4. Registrar a versao e o artefato que serao instalados no terminal.

### 2. Instalar no Windows

1. Em Windows 10 x64 ou Windows 11 x64, copiar o ZIP aprovado para a maquina.
2. Extrair o conteudo em uma pasta operacional definida pela implantacao.
3. Quando houver instalador homologado no release, ele pode substituir o ZIP; ate la, o ZIP continua sendo a referencia segura.
4. Abrir o executavel do Rayzen PDV.

### 3. Executar o first-run

1. Preencher a identificacao da empresa.
2. Revisar as impressoras de `COZINHA`, `BAR` e `CAIXA`.
3. Concluir o wizard.
4. Confirmar que o arquivo `%ProgramData%\RayzenPDV\config\runtime-config.json` foi criado.
5. Confirmar que o banco `%ProgramData%\RayzenPDV\data\rayzen-pdv.sqlite` foi criado.

### 4. Confirmar seed inicial

No primeiro terminal vazio, validar:

- operador `ADMIN`
- PIN inicial `1234`
- catalogo base com:
  - `Hamburguer`
  - `Batata frita`
  - `Refrigerante`
  - `Cerveja`

### 5. Revisar infraestrutura local

1. Verificar `%ProgramData%\RayzenPDV\logs\`.
2. Verificar `%ProgramData%\RayzenPDV\backups\`.
3. Verificar `%ProgramData%\RayzenPDV\spool\`.
4. Quando houver fiscal no piloto, verificar:
   `%ProgramData%\RayzenPDV\fiscal\xml\`
   `%ProgramData%\RayzenPDV\fiscal\danfe\`
   `%ProgramData%\RayzenPDV\fiscal\events\`

## Smoke operacional de homologacao

Executar, no minimo, este fluxo no terminal:

1. Abrir o Rayzen PDV.
2. Fazer login com o operador de teste local ou `ADMIN` no bootstrap inicial.
3. Abrir caixa.
4. Abrir comanda.
5. Adicionar itens do catalogo persistido.
6. Enviar para producao.
7. Confirmar criacao de job no spool persistido.
8. Validar impressao ou retry local quando a impressora falhar.
9. Iniciar checkout.
10. Confirmar pagamento.
11. Confirmar movimento de caixa.
12. Encerrar a comanda.
13. Fechar o caixa.
14. Reiniciar o app.
15. Confirmar persistencia de configuracao, caixa e comanda.

Quando o piloto incluir fiscal:

1. Confirmar que o emitente esta habilitado.
2. Confirmar que certificado A1 e CSC foram provisionados localmente.
3. Executar checkout com fila fiscal ativa.
4. Registrar se o documento ficou em sucesso, rejeicao ou contingencia.
5. Confirmar localizacao do XML e dos eventos fiscais quando existirem fora do banco.

## Checklist objetivo para aprovar homologacao

- [ ] release aprovada com ZIP e manifesto
- [ ] instalacao validada no Windows alvo do cliente
- [ ] `runtime-config.json` criado
- [ ] banco SQLite criado
- [ ] `ADMIN` validado no bootstrap
- [ ] catalogo inicial validado
- [ ] impressoras revisadas por setor
- [ ] spool persistido validado
- [ ] backup criado
- [ ] restore testado em homolog
- [ ] logs exportados com sucesso
- [ ] fiscal validado, quando aplicavel
- [ ] reinicio do app preservando estado local

## O que fazer em caso de falha

Falha de impressao:

1. Conferir impressora no Windows.
2. Conferir jobs em `%ProgramData%\RayzenPDV\spool\`.
3. Reprocessar o job quando a causa operacional for corrigida.
4. Nao bloquear a venda por falha de impressora.

Falha fiscal:

1. Conferir pendencias fiscais no terminal.
2. Consultar situacao pela chave antes de reenviar.
3. Se houver contingencia, localizar o DANFE e a justificativa local.
4. Nao exportar os segredos fiscais.

Falha de maquina:

1. Instalar o Rayzen PDV na nova maquina.
2. Restaurar backup valido.
3. Reprovisionar segredos fiscais fora do backup comum.
4. Reexecutar o smoke minimo.

## Evidencias que devem ser guardadas

- versao instalada
- copia do `manual-rollout-manifest.json`
- nome do ZIP aplicado
- nome das impressoras configuradas
- exportacao de logs
- resultado do smoke de homologacao
- evidencias fiscais, quando aplicavel

## Referencias relacionadas

- `docs/RUNBOOKS/installation.md`
- `docs/RUNBOOKS/client-validation-package.md`
- `docs/RUNBOOKS/pilot-operation.md`
- `docs/RUNBOOKS/backup-restore.md`
- `docs/RUNBOOKS/troubleshooting.md`
- `docs/qa/pilot-deployment-checklist.md`
- `docs/qa/release-report-pilot.md`
