# Regras de roteamento (PDV Rayzen)

- Cada produto ou categoria resolve para um setor, como `COZINHA` ou `BAR`.
- Cada setor resolve para uma ou mais impressoras, em ordem.
- Job contem `id`, `setor`, `payload`, `tentativa` e `status`.
