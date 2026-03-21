# Tech Decisions - Rayzen PDV

> Este documento registra as decisoes tecnicas do projeto. Use `Decidido`, `Proposto` e `Aberto` para evitar ambiguidade.

## Objetivo

Fechar lacunas tecnicas suficientes para iniciar a implementacao do projeto sem inventar arquitetura a cada tarefa.

## Matriz de decisoes

| ID | Tema | Status | Decisao | Motivo |
| --- | --- | --- | --- | --- |
| TD-01 | Monorepo | Decidido | Estrutura com `apps/pdv`, `packages/ui`, `packages/db`, `electron`, `docs` | Separa renderer, dominio visual, persistencia e processo principal |
| TD-02 | Package manager | Decidido | `pnpm` workspaces como padrao | Rapido, previsivel e adequado para monorepo |
| TD-03 | Runtime Node | Decidido | Node.js 22 LTS | Baseline moderna e estavel para Electron e TypeScript |
| TD-04 | Linguagem | Decidido | TypeScript estrito | Reduz erro em dominio e IPC |
| TD-05 | Renderer | Decidido | App desktop em Electron com renderer dedicado | Mantem operacao local e integracao com hardware |
| TD-06 | Comunicacao interna | Decidido | IPC como caminho padrao no MVP; API local apenas se surgir necessidade externa real | Reduz superficie de ataque e complexidade inicial |
| TD-07 | Persistencia local | Decidido | SQLite em arquivo local, com WAL habilitado apos validacao no projeto | Combina simplicidade operacional com boa resiliencia |
| TD-08 | Fila persistente | Decidido | Spool de impressao e fila fiscal devem persistir localmente, preferencialmente no SQLite | Simplifica recuperacao apos falha e auditoria |
| TD-09 | Sincronizacao | Decidido | Sem sync obrigatoria no MVP | Mantem offline-first sem dependencia externa |
| TD-10 | Testes | Decidido | Jest para unitarios e integracao, mais smoke offline guiado por runbook | Alinha com baseline do projeto |
| TD-11 | Logging | Decidido | Logs locais exportaveis, sem PII, com niveis por ambiente | Facilita suporte de campo sem violar privacidade |
| TD-12 | Autenticacao | Decidido | Login local por operador com PIN e papeis `CAIXA`, `GARCOM`, `GERENTE` no MVP | Menor complexidade para a primeira entrega com controle operacional simples |
| TD-13 | Packaging | Decidido | Electron Forge como baseline inicial de empacotamento | Integracao boa com ecossistema Electron e makers |
| TD-14 | Auto-update | Decidido | Desabilitado no MVP; rollout manual controlado | Reduz risco operacional nas primeiras implantacoes |
| TD-15 | Assinatura de codigo | Decidido | Nao bloquear dev, homolog ou piloto por assinatura. Assinatura de codigo passa a ser obrigatoria antes do primeiro rollout em producao, apos validacao do piloto no cliente | Mantem velocidade no MVP sem liberar producao sem confianca minima no instalador Windows |
| TD-16 | Estrategia de impressao | Decidido | MVP com impressoras termicas de diversas marcas, usando baseline inicial por driver do Windows. Camadas adicionais, como bridge dedicada ou ESC/POS direto, ficam para avaliacao posterior se o piloto exigir | Reduz complexidade inicial e permite validar hardware real no piloto antes de sofisticar a integracao |
| TD-17 | Escopo fiscal inicial | Decidido | UF inicial: Sao Paulo. Documento fiscal de consumidor no rollout comercial: NFC-e modelo 65. Integrador oficial do piloto: NS Tecnologia | Alinha o produto ao escopo inicial informado e fixa um provider fiscal para o primeiro rollout controlado |
| TD-18 | CI/CD | Decidido | Pipeline minimo oficial: instalar dependencias, rodar lint/typecheck/testes, gerar build Electron e publicar artefato versionado. GitHub Actions e a recomendacao inicial quando o repositorio estiver no GitHub; se nao, a plataforma equivalente deve manter o mesmo fluxo | Fecha o baseline de release reproduzivel sem travar a equipe em uma plataforma antes da hora |
| TD-19 | Certificado fiscal | Decidido | Baseline inicial: e-CNPJ A1 ICP-Brasil por emitente. A3 fica fora do baseline do piloto e so entra por decisao operacional posterior | Simplifica homologacao e integracao com o provider fiscal escolhido, reduzindo variacao no suporte de campo |
| TD-20 | Rollout e rollback | Decidido | Rollout manual e controlado no MVP. Promocao entre ambientes ocorre por versao aprovada; rollback operacional usa reinstalacao da ultima versao aprovada e restore do backup validado do terminal, com registro do incidente | Cria um caminho simples de suporte em campo antes de auto-update e orquestracao central |
| TD-21 | Guarda fiscal | Decidido | Reter XML e eventos fiscais por no minimo 132 meses contados da autorizacao do documento, com possibilidade de ampliar por exigencia contratual ou legal especifica | Alinha a guarda minima ao Ajuste SINIEF 2/25 e evita perda de evidencia fiscal |
| TD-22 | Gestao do certificado A1 | Decidido | Certificado A1 deve ficar armazenado com criptografia em repouso e acesso restrito por emitente. Renovacao operacional deve iniciar 45 dias antes do vencimento e concluir com validacao ate 15 dias antes do vencimento | Reduz risco de indisponibilidade fiscal e minimiza exposicao da chave privada |
| TD-23 | Contingencia fiscal com NS Tecnologia | Decidido | No baseline com NS Client, a emissao deve entrar automaticamente em contingencia offline quando nao houver comunicacao valida, registrar `tpEmis=9`, `dhCont` e `xJust`, imprimir DANFE de contingencia e reenviar ate autorizacao ou tratamento manual do erro | Fecha o fluxo tecnico minimo de contingencia sem espalhar regra fiscal pela aplicacao |
| TD-24 | Criptografia local de segredos fiscais | Decidido | No baseline Windows, certificado A1, senha associada e CSC devem ser protegidos com Windows DPAPI no terminal. Backups que incluirem esses segredos devem sair cifrados separadamente do backup operacional comum | Fecha o mecanismo minimo de protecao em repouso para a trilha fiscal no MVP |

## Defaults tecnicos para inicio do projeto

Enquanto as decisoes `Proposto` e `Aberto` nao forem ratificadas, use estes defaults para desenvolver sem paralisar o projeto:

- usar `pnpm`
- usar Node.js 22 LTS
- modelar IPC antes de expor HTTP local
- construir fila persistente em SQLite
- manter sync, telemetria e auto-update desligados por padrao
- tratar Windows como sistema principal de execucao
- tratar apenas ajustes finos de homologacao fiscal como trilha aberta

## Estrutura de codigo sugerida

```text
apps/pdv/
  src/
    application/
    domain/
    features/
    infra/
    ui/
packages/ui/
  src/
packages/db/
  src/
  migrations/
electron/
  src/
  builders/
```

## Contratos obrigatorios entre camadas

- UI nao decide regra de negocio critica.
- Dominio nao depende de framework visual.
- Persistencia nao define regras de tela.
- Impressao e fiscal entram por adaptadores explicitamente testaveis.

## Decisoes que precisam de sign-off humano

As decisoes abaixo nao devem ser fechadas apenas por implementacao:

- matriz oficial de impressoras
- politica de retencao legal
- credenciamento, CSC e homologacao fiscal em Sao Paulo

## Notas abertas no momento

- Impressoras: baseline confirmado como termicas de diversas marcas via driver do Windows; falta lista homologada consolidada apos piloto.
- Fiscal: escopo inicial definido para Sao Paulo com NFC-e e integrador NS Tecnologia no piloto; detalhes de homologacao em ambiente real ainda exigem validacao humana.
- Certificado fiscal: baseline definido como e-CNPJ A1; A3 fica fora do piloto inicial.
- Guarda fiscal: XML e eventos devem seguir retencao minima de 132 meses.
- Segredos fiscais locais: proteger com Windows DPAPI no terminal.
- CI/CD: baseline funcional fechado; a plataforma final depende apenas do hosting oficial do repositorio.
- Assinatura de codigo: obrigatoria apenas antes da ida para producao, depois do piloto. Provedor final continua em aberto.

## Como atualizar este documento

Sempre que uma decisao `Proposto` ou `Aberto` for fechada:

1. mudar o status
2. registrar a decisao final
3. atualizar os documentos impactados
4. ajustar skills e runbooks se necessario
