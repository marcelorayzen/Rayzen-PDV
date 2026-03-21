# Politica de falhas

- Impressora offline: `WAITING_PRINTER`, com retry e backoff.
- Sem papel: `NEEDS_ATTENTION`, exige acao humana.
- Crash: jobs pendentes devem reaparecer por persistencia.
