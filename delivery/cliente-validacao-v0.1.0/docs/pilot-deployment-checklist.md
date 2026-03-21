# Checklist de Implantacao - Rayzen PDV

## Objetivo

Garantir que um terminal esteja pronto para piloto controlado em restaurante antes do primeiro atendimento real.

## Infraestrutura do terminal

- [ ] Windows 10 x64 ou Windows 11 x64 validado para o terminal
- [ ] teclado fisico disponivel
- [ ] impressoras termicas conectadas e visiveis no Windows
- [ ] pasta operacional acessivel em `%ProgramData%\\RayzenPDV\\`
- [ ] ZIP aprovado e `manual-rollout-manifest.json` conferidos

## Instalacao e first-run

- [ ] Rayzen PDV instalado via ZIP aprovado ou instalador aprovado quando disponivel
- [ ] `%ProgramData%\\RayzenPDV\\data\\rayzen-pdv.sqlite` criado
- [ ] `%ProgramData%\\RayzenPDV\\config\\runtime-config.json` criado
- [ ] operador `ADMIN` seedado
- [ ] first-run concluido com empresa local preenchida
- [ ] impressoras de `COZINHA`, `BAR` e `CAIXA` revisadas no wizard
- [ ] catalogo inicial carregado

## Operacao minima

- [ ] login local por PIN validado
- [ ] caixa aberto
- [ ] comanda aberta
- [ ] item adicionado
- [ ] envio para producao gerando spool persistido
- [ ] job de impressao localizado
- [ ] checkout confirmado
- [ ] movimento de caixa gerado
- [ ] comanda encerrada
- [ ] caixa fechado
- [ ] reinicio do aplicativo confirmando persistencia

## Suporte e seguranca

- [ ] exportacao de logs validada
- [ ] localizacao do banco conhecida pela operacao
- [ ] localizacao dos backups conhecida pela operacao
- [ ] `backup.criar()` validado
- [ ] `backup.restaurar()` validado em homolog
- [ ] segredos fiscais fora do backup operacional comum

## Fiscal, quando aplicavel

- [ ] emitente configurado
- [ ] certificado A1 e CSC provisionados localmente
- [ ] ambiente de homologacao validado
- [ ] pendencias fiscais localizaveis
- [ ] contingencia conhecida pela equipe de suporte

## Evidencia final de piloto

- [ ] `pnpm test`, `pnpm test:smoke:offline` e `pnpm test:smoke:install` aprovados
- [ ] `pnpm test:validate:printing` aprovado
- [ ] `pnpm test:validate:cash` aprovado
- [ ] `pnpm qa:pilot` gerado
- [ ] release report do piloto anexado
