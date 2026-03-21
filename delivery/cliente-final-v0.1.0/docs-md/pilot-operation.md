# Runbook - Piloto Assistido (Rayzen PDV)

## Objetivo

Orientar a primeira operacao controlada do Rayzen PDV em restaurante, com foco em suporte rapido, coleta de evidencia e contencao de risco.

## Pre-requisitos

- release manual aprovada
- `%ProgramData%\\RayzenPDV\\` acessivel no terminal
- operador `ADMIN` disponivel
- impressoras dos setores configuradas
- equipe local ciente do fluxo de backup e troubleshooting
- emitente fiscal configurado quando o piloto incluir NFC-e

## Primeiro acesso

1. Abrir o Rayzen PDV.
2. Concluir o wizard de first-run se o terminal estiver vazio.
3. Confirmar o `ADMIN / 1234` apenas para validar o bootstrap inicial.
4. Confirmar que o banco local, logs, spool e `runtime-config.json` foram criados.
5. Registrar a versao instalada e o artefato aplicado.

## Operacao diaria minima do piloto

1. Abrir caixa.
2. Abrir comanda.
3. Adicionar itens.
4. Enviar para producao.
5. Confirmar o job no spool e o despacho para a impressora do setor.
6. Iniciar checkout.
7. Confirmar pagamento.
8. Encerrar a comanda.
9. Fechar o caixa com conferencia.
10. Reiniciar o app ao menos uma vez no piloto e validar persistencia.

## Diagnostico rapido

Conseguir localizar sem apoio de engenharia:

- versao instalada
- `%ProgramData%\\RayzenPDV\\data\\rayzen-pdv.sqlite`
- `%ProgramData%\\RayzenPDV\\config\\runtime-config.json`
- `%ProgramData%\\RayzenPDV\\backups\\`
- `%ProgramData%\\RayzenPDV\\spool\\`
- `%ProgramData%\\RayzenPDV\\fiscal\\xml\\`
- `%ProgramData%\\RayzenPDV\\fiscal\\events\\`

## Falha de impressora

1. Nao bloquear a venda.
2. Conferir nome da impressora no Windows.
3. Verificar job em `WAITING_PRINTER` ou `NEEDS_ATTENTION`.
4. Corrigir papel, cabo, energia ou driver.
5. Reprocessar o job ou emitir segunda via controlada.
6. Registrar a ocorrencia no report do piloto.

## Falha fiscal

1. Verificar pendencias na fila fiscal.
2. Confirmar se houve autorizacao, rejeicao ou contingencia.
3. Se houver contingencia, localizar DANFE e justificativa local.
4. Consultar a situacao pela chave antes de repetir envio.
5. Nao exportar segredos do emitente em anexos de suporte.

## Troca de maquina

1. Instalar o Rayzen PDV na nova maquina.
2. Restaurar backup valido.
3. Reconfigurar segredos fiscais fora do backup comum.
4. Revisar impressoras do terminal.
5. Executar smoke minimo de instalacao e operacao.

## Limitacoes conhecidas do piloto

- rollout operacional validado por ZIP com manifesto
- instalador Squirrel ainda nao homologado neste host
- impressoras reais e fiscal ainda dependem de homologacao assistida
- assinatura de codigo segue fora desta fase
