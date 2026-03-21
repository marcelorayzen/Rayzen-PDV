# Invariantes (PDV Rayzen)

- Uma comanda `ENCERRADA` ou `CANCELADA` nao pode receber itens.
- Item `ENVIADO` nao pode ser removido silenciosamente; exige cancelamento e auditoria.
- Total pago nao pode exceder total devido, salvo troco controlado em dinheiro.
- Cada acao critica gera um evento de auditoria.

## Checklist humano

- Existe teste cobrindo a nova regra?
- A regra funciona offline, sem internet?
