# Contratos de dominio

## Principios

- DTOs versionaveis; evitar breaking changes sem justificativa.
- Operacoes repetiveis, como enviar producao, devem usar idempotencia.

## Sugestao de endpoints

- `POST /comandas`
- `POST /comandas/{id}/itens`
- `POST /comandas/{id}/enviar-producao`
- `POST /comandas/{id}/pre-conta`
- `POST /comandas/{id}/checkout`
