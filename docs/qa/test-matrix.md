# Matriz de Regressao - Rayzen PDV

## Dimensoes cobertas

- online versus offline
- impressora operacional versus indisponivel
- caixa aberto versus fechado
- comanda em abertura, producao, pagamento e encerramento
- renderer via shell teclado-first
- servicos do Electron via IPC

## Suites automatizadas

### Unit

- `apps/pdv`: atalhos, ciclo da comanda, cancelamento, guardrails de checkout e guardrails de caixa
- `packages/db`: sidecars SQLite e carga de migrations
- `electron`: paths, redaction de logs e criacao da janela principal

### Integration

- `apps/pdv`: autenticacao por PIN, controller da comanda, controller de caixa e render do shell
- `packages/db`: schema bootstrap, repositorios, spool, caixa, fiscal e rollback
- `electron`: spool, fiscal, contingencia, suporte operacional, IPC e preload

### Validacoes operacionais

- smoke offline ponta a ponta do baseline local
- smoke de instalacao, first-run e reinicio do terminal
- validacao dedicada de impressao por setor, retry e segunda via
- validacao dedicada de caixa com conferencia e divergencia

## Gaps intencionais

- homologacao com impressoras fisicas continua fora da automacao
- fiscal em ambiente real do provider permanece dependencia de validacao humana
- o instalador Squirrel ainda nao fecha neste host; o piloto validado continua apoiado em ZIP com manifesto
