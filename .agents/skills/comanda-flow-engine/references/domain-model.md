# Dominio - Comanda (PDV Rayzen)

## Estados canonicos

`ABERTA -> EM_PRODUCAO -> EM_PAGAMENTO -> ENCERRADA`

`ABERTA`, `EM_PRODUCAO` e `EM_PAGAMENTO` tambem podem ir para `CANCELADA`, sempre com motivo e auditoria.

## Status de item

`LANCADO -> ENVIADO -> CANCELADO`

- `LANCADO`: editavel
- `ENVIADO`: restrito; exige correcao auditada
- `CANCELADO`: exige motivo e evento

## Regras-chave

- Split nao cria nova venda; apenas reorganiza itens e pagamentos com rastreabilidade.
- Desconto sempre associa operador e motivo.
- Checkout fecha o fluxo operacional da comanda e atualiza caixa.

## Exemplo

Consulte `../examples/comanda_events.ndjson`.
