# Guia de Schema (PDV Rayzen)

## Principios

- Preferir colunas explicitas para queries criticas.
- Usar chaves estaveis, como UUID ou ULID, com indices nos filtros mais usados.
- Separar trilha de auditoria de tabelas de estado atual.

## SQLite

- Adequado para app local e offline-first.
- Priorizar simplicidade operacional e transacoes consistentes.
