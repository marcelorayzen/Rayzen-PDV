# Fiscal - Rayzen PDV

> Escopo desta base: Sao Paulo, NFC-e modelo 65, provider `NS_TECNOLOGIA`, certificado `e-CNPJ A1`.

## O que existe hoje

- configuracao fiscal por emitente em `fiscal_emitters`
- fila persistente em `fiscal_queue`
- documentos fiscais rastreaveis em `fiscal_documents`
- eventos de transicao em `fiscal_document_events`
- checkout de comanda pode originar automaticamente um documento `NFC-e` em `DRAFT` e um item correspondente em `fiscal_queue`
- segredos locais protegidos no Windows por `safeStorage` do Electron, que usa DPAPI
- contingencia fiscal com `tpEmis=9`, `dhCont`, `xJust`, DANFE local e reenvio posterior
- consulta de situacao por chave de acesso sem depender de API HTTP local
- worker fiscal local no processo principal para consumir pendencias, enviar ao provider e reprocessar sem depender da UI

## Estados implementados

| Estado | Significado |
| --- | --- |
| `DRAFT` | documento preparado e enfileirado |
| `SIGNED` | payload assinado/localmente pronto para envio |
| `SENT` | provider recebeu o envio e ainda aguarda desfecho |
| `AUTHORIZED` | documento autorizado e XML guardado localmente |
| `CONTINGENCY` | documento emitido offline com `tpEmis=9`, DANFE de contingencia e pendencia de reenvio |
| `REJECTED` | documento rejeitado com codigo e mensagem rastreaveis |

## Guardrails

- nao inventar regra fiscal fora do escopo documentado
- nao registrar certificado, senha ou CSC em logs
- nao tratar CF-e-SAT como fluxo novo principal para Sao Paulo
- manter XML e eventos fiscais pela retencao minima definida

## Limites desta implementacao

- a integracao com `NS_TECNOLOGIA` continua como adaptador inicial e testavel, ainda sem homologacao real de campo
- o fluxo de contingencia implementa apenas o baseline local da fila, query por chave, DANFE e reenvio posterior
- nao ha tela fiscal dedicada no renderer nesta etapa; o caminho padrao continua em IPC no processo principal

## IPC operacional

- `fiscal.getStatus`: resumo de emitentes, pendencias e documentos recentes
- `fiscal.getDocumentStatus`: consulta o documento fiscal por `fiscalDocId`
- `fiscal.listPending`: lista pendencias da fila fiscal com referencia operacional
- `fiscal.reprocess`: dispara novo ciclo local de processamento da fila
- `fiscal.queryStatusByAccessKey`: consulta situacao remota por chave quando aplicavel
