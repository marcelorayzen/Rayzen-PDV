# OpenAPI - Rayzen PDV

O baseline atual do Rayzen PDV nao expoe API HTTP local em loopback.

A comunicacao entre renderer e processo principal acontece por IPC via preload seguro do Electron. Por isso, `openapi.yaml` existe apenas como registro explicito de que nao ha superficie HTTP operacional no estado atual do codigo.

Se o produto vier a introduzir uma API local no futuro, esta documentacao deve ser redesenhada a partir da implementacao real, e nao a partir de templates genericos.
