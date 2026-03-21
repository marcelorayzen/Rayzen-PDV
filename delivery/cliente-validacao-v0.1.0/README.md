# Pacote de Entrega - Cliente Validacao v0.1.0

## Conteudo

Este pacote contem apenas o necessario para validacao assistida do Rayzen PDV pelo cliente.

Arquivos principais:

- `rayzen-pdv-v0.1.0-zip-win32-x64-rayzen-pdv-win32-x64-0-1-0.zip`
- `manual-rollout-manifest.json`
- `docs/`

## Ordem recomendada de uso

1. Ler `docs/client-validation-package.md`
2. Ler `docs/homologation-installation.md`
3. Extrair o ZIP em uma pasta limpa no Windows
4. Executar o Rayzen PDV
5. Validar o fluxo minimo com apoio de:
   - `docs/pilot-operation.md`
   - `docs/pilot-deployment-checklist.md`
6. Em caso de problema, consultar:
   - `docs/troubleshooting.md`
   - `docs/backup-restore.md`

## Observacoes

- Este pacote nao inclui `.agents/` nem material interno de desenvolvimento.
- O rollout atual validado continua sendo por ZIP com manifesto.
- O cliente nao precisa de VSCode nem de acesso ao codigo-fonte para executar esta validacao.
