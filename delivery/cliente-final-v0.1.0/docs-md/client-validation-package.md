# Runbook - Pacote de Validacao para Cliente (Rayzen PDV)

## Objetivo

Padronizar o que deve ser enviado ao cliente para validacao assistida do Rayzen PDV e como coletar o retorno para afinamentos antes de ampliar o rollout.

## Quando usar

Usar este pacote quando o cliente for validar o Rayzen PDV em ambiente controlado de restaurante, com acompanhamento proximo e sem promocao para producao ampla.

## O que enviar ao cliente

Enviar um pacote fechado com:

1. artefato aprovado da release
2. manifesto da release
3. instrucoes de instalacao
4. checklist de implantacao
5. roteiro de operacao minima
6. roteiro de devolutiva

## Arquivos do pacote

Separar, no minimo, estes arquivos:

- release aprovada em `electron/out/releases/vX.Y.Z/windows/`
- `manual-rollout-manifest.json`
- ZIP operacional aprovado
- [docs/RUNBOOKS/homologation-installation.md](e:/Marcelo%20Projetos/Rayzen%20PDV/docs/RUNBOOKS/homologation-installation.md)
- [docs/RUNBOOKS/pilot-operation.md](e:/Marcelo%20Projetos/Rayzen%20PDV/docs/RUNBOOKS/pilot-operation.md)
- [docs/qa/pilot-deployment-checklist.md](e:/Marcelo%20Projetos/Rayzen%20PDV/docs/qa/pilot-deployment-checklist.md)

Se quiser reduzir atrito com o cliente:

- exportar os `.md` para PDF
- incluir uma mensagem curta com ordem de execucao

## Ordem recomendada de envio

1. Enviar o ZIP aprovado.
2. Enviar o `manual-rollout-manifest.json`.
3. Enviar o runbook de homologacao e instalacao.
4. Enviar o checklist de implantacao.
5. Enviar o roteiro de piloto assistido.

## Mensagem recomendada para o cliente

Texto base sugerido:

`Segue o pacote de validacao assistida do Rayzen PDV.`

`Use o arquivo de homologacao e instalacao para preparar a maquina e executar o passo a passo inicial.`

`Depois siga o checklist de implantacao e rode o fluxo minimo de operacao: login, abertura de caixa, abertura de comanda, itens, envio para producao, checkout, fechamento de caixa e reinicio do app.`

`Anote qualquer erro de impressao, fiscal, lentidao, travamento ou dificuldade operacional e nos envie junto com a versao instalada, logs exportados e nome das impressoras configuradas.`

## O que o cliente precisa validar

Fluxo minimo esperado:

1. instalar o Rayzen PDV pelo ZIP aprovado
2. abrir o app
3. concluir o `first-run`
4. validar o operador `ADMIN`
5. abrir caixa
6. abrir comanda
7. adicionar itens do catalogo
8. enviar para producao
9. confirmar spool e impressao
10. iniciar checkout
11. confirmar pagamento
12. fechar caixa
13. reiniciar o app
14. confirmar persistencia local

Quando houver fiscal no escopo:

1. validar se o emitente foi configurado
2. validar se a fila fiscal recebeu o documento
3. registrar se houve sucesso, rejeicao ou contingencia

## O que pedir de devolutiva

Pedir retorno sempre com:

- versao instalada
- nome do ZIP aplicado
- sistema operacional da maquina
- nome das impressoras configuradas
- passo em que o problema aconteceu
- comportamento esperado
- comportamento observado
- se o problema bloqueia ou nao a operacao
- logs exportados, quando possivel

## Modelo simples de devolutiva

Usar este formato:

- `Terminal:` identificacao da maquina
- `Versao:` versao instalada
- `Fluxo:` instalacao, login, comanda, impressao, caixa, fiscal ou backup
- `Passo:` numero ou descricao curta
- `Esperado:` o que deveria acontecer
- `Observado:` o que aconteceu
- `Impacto:` bloqueia, contorna ou nao bloqueia
- `Anexos:` logs, fotos da impressora, XML ou evidencias operacionais

## O que nao pedir ao cliente nesta fase

Nao pedir:

- acesso a codigo
- uso de VSCode
- alteracao manual de banco
- copia de segredos fiscais
- testes fora do roteiro combinado

## Criterio de aceite desta validacao

Considerar a validacao assistida suficiente quando:

- a instalacao ocorrer sem dependencia de ferramenta extra
- o `first-run` concluir corretamente
- o fluxo minimo de comanda, impressao e caixa passar
- o reinicio preservar estado local
- as pendencias encontradas estiverem registradas com evidencia reproduzivel

## Referencias relacionadas

- [Homologacao e Instalacao](e:/Marcelo%20Projetos/Rayzen%20PDV/docs/RUNBOOKS/homologation-installation.md)
- [Piloto Assistido](e:/Marcelo%20Projetos/Rayzen%20PDV/docs/RUNBOOKS/pilot-operation.md)
- [Checklist de Implantacao](e:/Marcelo%20Projetos/Rayzen%20PDV/docs/qa/pilot-deployment-checklist.md)
