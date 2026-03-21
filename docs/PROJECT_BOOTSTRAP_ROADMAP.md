# Roteiro de Criacao do Projeto Rayzen PDV

## Como usar

- Execute uma chamada por vez.
- Em cada nova conversa, cole o bloco completo da chamada correspondente.
- O repositorio parte de um estado documental e deve evoluir gradualmente.
- Sempre seguir a documentacao existente como fonte de verdade.
- Sempre respeitar os guardrails do projeto: offline-first, auditoria, sem PII em logs, sem dependencia de internet em fluxos criticos e sem copiar referencias de terceiros.

---

## Chamada 1

```text
Vamos executar o roteiro de criacao do projeto Rayzen PDV a partir da chamada 1.

Contexto:
- O repositorio esta atualmente em estado documental, sem apps implementados nem package.json funcional.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 1:
Crie a fundacao do monorepo do Rayzen PDV com pnpm workspaces, Node 22, TypeScript estrito, apps/pdv, packages/db, packages/ui e electron. Nao implemente regra de negocio ainda; apenas estrutura, tsconfig base, package.json raiz, scripts minimos e organizacao inicial coerente com a documentacao.
```

---

## Chamada 2

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 2.

Contexto:
- O repositorio saiu do estado apenas documental e ja deve conter a fundacao do monorepo criada na chamada 1.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 2:
Implemente a base de packages/db com SQLite local, WAL habilitavel, conexao central, migrations versionadas, suporte a up/down, tabela de auditoria de eventos, estrutura para spool persistente e fila fiscal. Nao implemente ainda a regra completa de comanda ou fiscal.
```

---

## Chamada 3

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 3.

Contexto:
- O repositorio ja deve conter a fundacao do monorepo e a base de packages/db criadas nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 3:
Implemente a base do processo principal em electron com IPC como caminho padrao, gerenciamento de paths em ProgramData, logs locais exportaveis e integracao inicial com packages/db. Mantenha a arquitetura offline-first e sem API HTTP local.
```

---

## Chamada 4

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 4.

Contexto:
- O repositorio ja deve conter a fundacao do monorepo, a base de packages/db e a base do processo principal em electron criadas nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 4:
Crie o shell inicial de apps/pdv com renderer desktop teclado-first, autenticacao local por PIN, layout base operacional e navegacao principal. Preserve a separacao entre UI, aplicacao e dominio, sem colocar regra critica na interface.
```

---

## Chamada 5

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 5.

Contexto:
- O repositorio ja deve conter a fundacao do monorepo, a base de packages/db, a base do processo principal em electron e o shell inicial do renderer criados nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 5:
Usando a skill comanda-flow-engine, implemente o dominio da comanda com estados ABERTA, EM_PRODUCAO, EM_PAGAMENTO, ENCERRADA e CANCELADA, incluindo abertura, lancamento de itens, cancelamento com motivo, envio para producao, pre-conta, checkout e auditoria.
```

---

## Chamada 6

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 6.

Contexto:
- O repositorio ja deve conter a fundacao do monorepo, a base de packages/db, a base do processo principal em electron, o shell inicial do renderer e o dominio da comanda criados nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 6:
Usando a skill pdv-ui-builder, implemente a interface operacional da comanda no apps/pdv com foco em teclado, densidade, produtividade, estados visuais claros e integracao com o dominio ja implementado.
```

---

## Chamada 7

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 7.

Contexto:
- O repositorio ja deve conter a fundacao do monorepo, a base de packages/db, a base do processo principal em electron, o shell inicial do renderer, o dominio da comanda e sua interface operacional criados nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 7:
Implemente o spool de impressao por setor com persistencia local, retries idempotentes, reimpressao com segunda via e integracao inicial com impressoras termicas via driver do Windows. Mantenha falha de impressora sem bloquear a venda.
```

---

## Chamada 8

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 8.

Contexto:
- O repositorio ja deve conter a fundacao do monorepo, a base de packages/db, a base do processo principal em electron, o shell inicial do renderer, o dominio da comanda, sua interface operacional e o spool de impressao criados nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 8:
Implemente o fluxo de caixa com abertura, recebimento por forma, sangria, suprimento, fechamento com conferencia, divergencia explicita e auditoria exportavel.
```

---

## Chamada 9

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 9.

Contexto:
- O repositorio ja deve conter a fundacao do monorepo, a base de packages/db, a base do processo principal em electron, o shell inicial do renderer, o dominio da comanda, sua interface operacional, o spool de impressao e o fluxo de caixa criados nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 9:
Implemente a trilha fiscal inicial de Sao Paulo com NFC-e modelo 65, provider NS Tecnologia, configuracao por emitente, certificado e-CNPJ A1, armazenamento seguro local dos segredos fiscais com DPAPI, fila persistente e estados fiscais rastreaveis.
```

---

## Chamada 10

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 10.

Contexto:
- O repositorio ja deve conter a fundacao do monorepo, a base de packages/db, a base do processo principal em electron, o shell inicial do renderer, o dominio da comanda, sua interface operacional, o spool de impressao, o fluxo de caixa e a trilha fiscal inicial criados nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 10:
Implemente o fluxo de contingencia fiscal para a NS Tecnologia com tpEmis=9, dhCont, xJust, impressao de DANFE em contingencia, reenvio posterior e consulta de situacao por chave, preservando auditoria e fila persistente.
```

---

## Chamada 11

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 11.

Contexto:
- O repositorio ja deve conter a fundacao do monorepo, a base de packages/db, a base do processo principal em electron, o shell inicial do renderer, o dominio da comanda, sua interface operacional, o spool de impressao, o fluxo de caixa, a trilha fiscal inicial e a contingencia fiscal criados nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 11:
Implemente backup, restore, exportacao de logs, redaction de PII e suporte operacional aos runbooks existentes, incluindo backup de XML e eventos fiscais quando estiverem fora do banco.
```

---

## Chamada 12

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 12.

Contexto:
- O repositorio ja deve conter a fundacao do monorepo, a base de packages/db, a base do processo principal em electron, o shell inicial do renderer, o dominio da comanda, sua interface operacional, o spool de impressao, o fluxo de caixa, a trilha fiscal inicial, a contingencia fiscal e os mecanismos de backup e suporte criados nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 12:
Implemente a configuracao de build e empacotamento com Electron Forge para Windows, scripts de build, artefatos versionados e base de rollout manual sem auto-update.
```

---

## Chamada 13

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 13.

Contexto:
- O repositorio ja deve conter a fundacao do monorepo, a base de packages/db, a base do processo principal em electron, o shell inicial do renderer, o dominio da comanda, sua interface operacional, o spool de impressao, o fluxo de caixa, a trilha fiscal inicial, a contingencia fiscal, os mecanismos de backup e suporte e o empacotamento inicial criados nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 13:
Usando qa-regression-pdv, crie a base de testes unitarios e integrados, smoke offline, validacao de impressao, validacao de caixa e release report para homolog e piloto.
```

---

## Chamada 14

```text
Vamos continuar o roteiro de criacao do projeto Rayzen PDV na chamada 14.

Contexto:
- O repositorio ja deve conter a implementacao principal do projeto criada nas chamadas anteriores.
- Siga a documentacao existente no repo como fonte de verdade, especialmente README.md, docs/ARCHITECTURE.md, docs/PRODUCT_REQUIREMENTS.md, docs/DOMAIN.md, docs/TECH_DECISIONS.md, docs/DEPLOYMENT.md, docs/OPERATIONS_MATRIX.md, docs/SECURITY_PRIVACY.md e docs/RUNBOOKS/*.
- Respeite os guardrails do projeto: offline-first, auditoria de regras criticas, sem dependencia de internet em fluxos operacionais, sem PII em logs e sem copiar referencias de terceiros.
- Trabalhe apenas no escopo desta chamada.

Chamada 14:
Revise a documentacao do projeto para refletir a implementacao real criada ate aqui, removendo placeholders e ajustando quickstart, arquitetura, deployment e runbooks ao estado do codigo.
```
