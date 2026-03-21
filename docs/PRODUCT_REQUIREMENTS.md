# Product Requirements - Rayzen PDV

> Este documento converte a visao de arquitetura e dominio em backlog executavel para construir o produto do zero.

## Objetivo

Definir o escopo funcional e nao funcional minimo do Rayzen PDV, separando MVP, versao comercial inicial e itens fora de escopo.

## Visao do produto

Rayzen PDV e um sistema desktop offline-first para bares e restaurantes. O produto deve permitir operar localmente, com baixa dependencia de internet, mantendo auditoria, resiliancia operacional e fluxo rapido para equipes de atendimento e caixa.

## Objetivos de negocio

- Reduzir impacto de queda de internet na operacao.
- Manter atendimento rapido em horarios de pico.
- Diminuir erros operacionais em comanda, producao e caixa.
- Facilitar suporte de campo com logs, backup e runbooks.
- Preparar base para fiscal, rollout controlado e eventual sincronizacao.

## Personas principais

### Caixa

- abre e fecha caixa
- recebe pagamentos
- fecha comandas
- trata divergencias e estornos

### Garcom

- abre comanda
- lanca itens
- envia producao
- consulta status da mesa ou atendimento

### Gerente

- autoriza cancelamentos e descontos
- acompanha divergencias
- valida fechamento e incidentes

### Implantacao e suporte

- instala o produto
- configura impressoras e terminais
- exporta logs
- executa backup, restore e troubleshooting

## Principios de produto

- Offline-first em todos os fluxos criticos.
- Teclado-first para produtividade.
- Auditoria obrigatoria para acoes sensiveis.
- UI e copy originais do Rayzen PDV.
- Fiscal e seguranca tratados como dominios de alto risco.

## Escopo por fase

### MVP operacional

Obrigatorio:

- autenticacao local por operador com PIN e papel operacional
- cadastro minimo de produtos, categorias, setores, mesas e terminais
- abertura, operacao e encerramento de comanda
- lancamento e cancelamento de itens com motivo
- envio para producao por setor com spool persistente
- pre-conta e checkout
- recebimento de pagamento e fechamento de caixa
- exportacao de logs, backup e restore
- instalacao local e validacao offline

Permitido com escopo reduzido:

- fiscal em modo desacoplado, sem rollout amplo
- integracao futura com sincronizacao, sem dependencia no fluxo principal

### V1 comercial

Adicionar:

- NFC-e homologada para Sao Paulo como primeira UF do rollout comercial
- integracao fiscal homologada com NS Tecnologia no piloto inicial
- painel de pendencias fiscais
- assinatura de codigo e processo de release controlado
- runbooks completos de implantacao e suporte
- runbook de onboarding fiscal para Sao Paulo com credenciamento, CSC e certificado
- homologacao de impressoras e hardware

### V2 e expansao

Adicionar:

- sincronizacao eventual
- telemetria opcional
- consolidacao central
- relatorios gerenciais
- automacao de rollout e update controlado

## Fora de escopo no inicio

- operacao dependente de nuvem
- marketplace ou e-commerce
- SSO corporativo
- multi-filial em tempo real no MVP
- copiar UX, fluxo visual ou assets de terceiros

## Requisitos funcionais

### RF-01 Cadastro base

O sistema deve permitir cadastrar:

- produtos e categorias
- setores de producao
- mesas, quando aplicavel
- operadores e papeis
- terminais e impressoras

### RF-02 Autenticacao local

O sistema deve permitir login local por operador via PIN, com papel operacional minimo:

- `CAIXA`
- `GARCOM`
- `GERENTE`

### RF-03 Comanda

O sistema deve permitir:

- abrir comanda
- associar mesa ou atendimento
- lancar itens
- alterar itens ainda nao enviados
- cancelar item ou comanda com motivo e ator
- dividir comanda e pagamentos mantendo rastreabilidade

### RF-04 Producao e impressao

O sistema deve:

- gerar jobs por setor ao enviar para producao
- manter spool persistente
- permitir retry sem duplicidade acidental
- registrar segunda via quando houver reimpressao

### RF-05 Pre-conta e checkout

O sistema deve:

- congelar uma visao auditavel do total
- aceitar uma ou mais formas de pagamento
- encerrar a comanda apenas apos pagamento valido ou cancelamento auditado

### RF-06 Caixa

O sistema deve:

- abrir sessao de caixa
- registrar pagamentos por forma
- permitir sangria e suprimento com auditoria
- fechar caixa com conferencia e divergencia explicita

### RF-07 Fiscal

O sistema deve:

- preparar emissao fiscal por fila persistente
- registrar estados e eventos fiscais
- permitir contingencia e transmissao posterior
- manter rastreabilidade de rejeicao, retentativa e cancelamento

Observacao:

- O escopo fiscal inicial e Sao Paulo com NFC-e.
- O provider fiscal oficial do piloto e a NS Tecnologia.
- O certificado baseline e e-CNPJ A1.
- Credenciamento, CSC e fluxo homologado final ainda dependem de validacao humana.

### RF-08 Suporte e operacao

O sistema deve:

- exportar logs sem PII desnecessaria
- executar backup e restore
- exibir versao instalada
- oferecer evidencias minimas para troubleshooting

## Requisitos nao funcionais

### RNF-01 Resiliencia offline

- abrir comanda, lancar item, enviar producao, checkout e caixa devem funcionar sem internet

### RNF-02 Desempenho operacional

- tempo de resposta de acoes locais deve ser percebido como imediato pelo operador
- navegacao principal deve ser teclado-first

### RNF-03 Integridade

- toda mudanca critica deve ser persistida com transacao
- spool, caixa e fila fiscal nao podem desaparecer apos crash

### RNF-04 Auditabilidade

- eventos criticos devem ser exportaveis
- cancelamento, desconto, estorno e divergencia precisam de ator e motivo

### RNF-05 Seguranca e privacidade

- nao registrar PII em logs comuns
- proteger backup e dados locais
- aplicar privilegio minimo por papel

### RNF-06 Manutenibilidade

- regras de dominio devem ficar concentradas no dominio
- migrations devem ser versionadas com rollback
- release precisa ser reproduzivel

## Criterios de aceite do MVP

O MVP so pode ser considerado pronto quando todos os itens abaixo forem verdadeiros:

- venda completa offline funciona do inicio ao fim
- spool de impressao persiste e reprocessa falhas
- caixa abre, recebe e fecha com auditoria
- backup e restore foram testados
- logs podem ser exportados
- smoke test offline esta documentado e reproduzivel

## Dependencias de decisao

Antes de considerar o produto pronto para rollout comercial, ainda precisam de definicao formal:

- matriz de impressoras homologadas
- credenciamento, CSC e homologacao fiscal para Sao Paulo
- processo de assinatura de codigo
- politica de update e canais
- retencao operacional e fiscal

## Relacao com outros documentos

- arquitetura tecnica: `docs/ARCHITECTURE.md`
- dominio e invariantes: `docs/DOMAIN.md`
- release e rollout: `docs/DEPLOYMENT.md`
- seguranca e privacidade: `docs/SECURITY_PRIVACY.md`
- baseline operacional: `docs/OPERATIONS_MATRIX.md`
- decisoes pendentes e propostas: `docs/TECH_DECISIONS.md`
