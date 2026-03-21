# Smoke Offline - Rayzen PDV

## Objetivo

Validar que o baseline local continua operando sem dependencia de internet em comanda, impressao e caixa.

## Script automatizado

```bash
pnpm test:smoke:offline
```

Cobertura atual do smoke:

- first-run e bootstrap local do terminal
- login local por PIN no shell
- abertura e progressao basica da comanda
- fluxo operacional de caixa no renderer
- spool de impressao local
- IPC do Electron com comportamento offline-first e sem API HTTP local

## Checklist manual para homolog

1. desconectar a internet
2. concluir o first-run em terminal limpo, quando aplicavel
3. autenticar operador local
4. abrir comanda e lancar item
5. enviar para producao
6. confirmar que a venda nao trava se a impressora estiver indisponivel
7. gerar pre-conta e concluir checkout
8. abrir e fechar caixa com conferencia
9. exportar logs redigidos e registrar a versao instalada

## Checklist adicional para piloto

1. repetir o smoke de homolog em hardware real
2. validar nome e disponibilidade das impressoras no Windows
3. reimprimir segunda via
4. confirmar backup e restore no terminal de campo
5. reiniciar o aplicativo e confirmar persistencia
6. registrar evidencias no release report do piloto
