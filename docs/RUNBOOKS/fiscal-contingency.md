# Runbook - Contingencia Fiscal (Rayzen PDV)

> Escopo inicial de rollout fiscal: Sao Paulo com NFC-e. Provider fiscal oficial do piloto: NS Tecnologia. Certificado baseline: e-CNPJ A1.

## Objetivo

Operar quando nao for possivel transmitir documentos fiscais, mantendo rastreabilidade e transmissao posterior.

## Principios

- Se nao transmitiu ou nao obteve resposta, o sistema pode operar em contingencia.
- Deve existir fila persistente de pendencias.
- Deve existir auditoria de emissao, contingencia e rejeicao.
- Nao tratar CF-e-SAT como fluxo principal novo para Sao Paulo.
- O comportamento final de contingencia deve seguir a homologacao do fluxo com a NS Tecnologia.
- No baseline com NS Client, a emissao em contingencia deve registrar `tpEmis=9`, `dhCont` e `xJust`.
- O DANFE de contingencia deve ser impresso e a nota deve ser reenviada para autorizacao depois da normalizacao.
- O prazo operacional do projeto deve obedecer ao prazo fiscal aplicavel para transmissao posterior; a documentacao da NS referencia o envio ate o final do primeiro dia util subsequente.

## Procedimento

1. Identificar falha de comunicacao com internet, SEFAZ ou servico intermediario.
2. Ao falhar a transmissao ou nao haver resposta, registrar `tpEmis=9`, `dhCont` e `xJust` no documento local.
3. Gerar DANFE de contingencia em `%ProgramData%\\RayzenPDV\\fiscal\\danfe\\` e tentar imprimir pela impressora configurada do emitente.
4. Registrar pendencia fiscal com status `CONTINGENCY`, sem bloquear a venda.
5. Quando normalizar, reprocessar a fila persistente e consultar a situacao pela chave quando houver duvida.
6. Se houver retorno autorizado, guardar XML e manter a trilha da contingencia no historico.
7. Se houver retorno nao autorizado, registrar o erro, corrigir a causa e reenviar o documento com os dados de contingencia preservados quando aplicavel.
8. Arquivar XML, DANFE de contingencia, eventos e logs conforme politica de retencao.

## Evidencias

- Lista de documentos pendentes.
- Logs de tentativa e ultimo erro.
- Marcadores de data e hora local.
- DANFE de contingencia gerado localmente.
- Consulta por chave documentada quando houver duvida sobre o desfecho.
