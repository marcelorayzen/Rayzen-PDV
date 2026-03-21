# Operations Matrix - Rayzen PDV

> Este documento define o baseline operacional para instalacao, suporte, rollout e operacao em campo.

## Objetivo

Consolidar ambiente suportado, parametros operacionais e gates minimos para cada estagio de rollout.

## Ambientes

| Ambiente | Objetivo | Dados | Update | Uso esperado |
| --- | --- | --- | --- | --- |
| `dev` | desenvolvimento local | descartavel ou sintetico | manual | implementacao e debug |
| `homolog` | validacao tecnica | base de teste | manual e controlado | smoke offline, impressao e caixa |
| `pilot` | validacao com cliente controlado | dados reais com acompanhamento | manual e agendado | validacao de campo |
| `prod` | operacao comercial | dados reais | controlado por release aprovada | atendimento diario |

## Sistema operacional e hardware

| Item | Baseline inicial | Status |
| --- | --- | --- |
| SO principal | Windows 10/11 x64 | Decidido |
| CPU minima | 4 cores | Decidido |
| RAM minima | 8 GB | Decidido |
| Armazenamento minimo | SSD 256 GB | Decidido |
| Resolucao minima | 1366x768 | Decidido |
| Teclado fisico | obrigatorio | Decidido |
| Internet | opcional para operar; recomendada para suporte e retentativas | Decidido |

## Impressoras e perifericos

| Item | Baseline inicial | Status |
| --- | --- | --- |
| Impressora de producao | termica de diversas marcas, com baseline inicial via driver do Windows | Decidido |
| Conexao | USB ou Ethernet | Decidido |
| Impressao por setor | obrigatoria | Decidido |
| Reimpressao controlada | obrigatoria, com segunda via | Decidido |
| Retry local de spool | automatico, sem bloquear a venda | Decidido |
| Matriz de modelos homologados | ainda nao definida | Aberto |

## Paths operacionais sugeridos

| Recurso | Caminho sugerido no Windows | Observacao |
| --- | --- | --- |
| Banco local | `%ProgramData%\\RayzenPDV\\data\\rayzen-pdv.sqlite` | um banco por terminal |
| Config operacional | `%ProgramData%\\RayzenPDV\\config\\runtime-config.json` | first-run, empresa local e impressoras do terminal |
| Logs | `%ProgramData%\\RayzenPDV\\logs\\` | exportavel para suporte |
| Backups | `%ProgramData%\\RayzenPDV\\backups\\` | proteger por acesso |
| Spool | `%ProgramData%\\RayzenPDV\\spool\\` | usar se parte do spool ficar fora do DB |
| Fiscal eventos | `%ProgramData%\\RayzenPDV\\fiscal\\events\\` | usar apenas quando eventos fiscais forem exportados fora do banco |
| Fiscal DANFE | `%ProgramData%\\RayzenPDV\\fiscal\\danfe\\` | contingencia local por emitente |
| Fiscal XML | `%ProgramData%\\RayzenPDV\\fiscal\\xml\\` | guarda local por emitente |
| Fiscal segredos | `%ProgramData%\\RayzenPDV\\fiscal\\secrets\\` | uso restrito, protegido por DPAPI |
| Exportacoes | pasta escolhida pelo operador ou suporte | nao fixar sem necessidade |

## Politicas operacionais iniciais

| Tema | Baseline inicial | Status |
| --- | --- | --- |
| Backup | diario | Decidido |
| Restore | validar em homolog antes de rollout | Decidido |
| RPO alvo | ate 1 turno | Decidido |
| RTO alvo | ate 2 horas para terminal isolado | Decidido |
| Segredos no backup | proibido incluir DPAPI secrets | Decidido |
| Restore seguro | validar manifesto e `integrity_check` antes de concluir | Decidido |
| Fluxo de caixa | abertura e fechamento por sessao local, com divergencia explicita | Decidido |
| Fluxo fiscal SP | NFC-e 65 por emitente, provider NS Tecnologia, fila local persistente, contingencia `tpEmis=9` e reenvio posterior | Decidido |
| Retencao de logs locais | 30 dias | Decidido |
| Retencao fiscal | XML e eventos fiscais por no minimo 132 meses a partir da autorizacao | Decidido |
| Export de logs | sem PII desnecessaria | Decidido |
| Auto-update | desabilitado no MVP | Decidido |
| Assinatura de codigo | obrigatoria apenas antes da primeira ida para `prod`, apos piloto aprovado | Decidido |

## Gates de rollout

### Para sair de `dev` para `homolog`

- testes do pacote afetado passam
- smoke offline descrito em runbook
- smoke de instalacao e reinicio executado
- spool e caixa validados com exemplos
- spool por setor e recuperacao de falha de impressora validados em smoke offline
- abertura, sangria, suprimento e fechamento de caixa validados com auditoria exportavel

### Para sair de `homolog` para `pilot`

- release manual versionada gerada com manifesto validado
- first-run validado em terminal limpo
- impressora real validada
- backup e restore testados
- release report gerado

### Para sair de `pilot` para `prod`

- changelog fechado
- versao aprovada
- fiscal validada para o escopo de UF atendido
- runbooks revisados
- assinatura de codigo aplicada
- plano de rollback documentado

## Evidencias obrigatorias por incidente

Sempre coletar:

- versao instalada
- ambiente e SO
- impressoras conectadas
- passos para reproduzir
- logs exportados
- hash do commit, quando disponivel

## Dependencias operacionais ainda abertas

- lista oficial de impressoras homologadas
- homologacao final do instalador Windows em Windows 10 e Windows 11
- credenciamento e CSC para Sao Paulo
- homologacao fiscal do fluxo com NS Tecnologia
- runbook operacional de onboarding fiscal SP executado e revisado

## Relacao com outros documentos

- requisitos funcionais: `docs/PRODUCT_REQUIREMENTS.md`
- arquitetura: `docs/ARCHITECTURE.md`
- deployment: `docs/DEPLOYMENT.md`
- seguranca e privacidade: `docs/SECURITY_PRIVACY.md`
- runbooks: `docs/RUNBOOKS/*`
