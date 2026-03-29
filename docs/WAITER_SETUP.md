# Rayzen PDV — Servidor do Garçom (Waiter HTTP Server)

Guia técnico para configurar e implantar o módulo de atendimento mobile dos garçons.

---

## O que é

O Rayzen PDV embute um servidor HTTP na porta **3030** que roda automaticamente dentro do processo Electron. Garçons e atendentes acessam esse servidor pelo navegador do celular ou tablet conectado à **mesma rede Wi-Fi** do computador que roda o PDV.

Não é necessário nenhum software adicional, nenhuma conexão com a internet e nenhuma instalação nos dispositivos dos garçons.

---

## Arquitetura

```
Dispositivo do garçom (celular/tablet)
  └─ Navegador → http://<IP-LOCAL>:3030
                          │
                          ▼
              Electron Main Process
              WaiterHttpServer (porta 3030)
                    │
                    ├─ OperatorAuthService  (autenticação por PIN)
                    ├─ CatalogService       (lista de produtos)
                    └─ PdvRoundtripService  (abertura/itens/produção)
```

Sessões de garçom são mantidas **em memória** com TTL de 8 horas. Reiniciar o app invalida todas as sessões.

---

## Fluxo de dados

| Etapa | Rota HTTP | Serviço interno |
|---|---|---|
| Login com PIN | `POST /api/auth` | `OperatorAuthService.login()` |
| Listar produtos | `GET /api/catalog` | `CatalogService.listProducts()` |
| Abrir comanda | `POST /api/comanda/open` | `PdvRoundtripService.openComanda()` |
| Adicionar item | `POST /api/comanda/add-item` | `PdvRoundtripService.addComandaItem()` |
| Enviar para produção | `POST /api/comanda/producao` | `PdvRoundtripService.sendComandaToProduction()` |

---

## Pré-requisitos

- O computador do PDV deve estar conectado ao roteador via **Wi-Fi ou cabo**.
- O celular/tablet do garçom deve estar na **mesma rede** (mesmo roteador).
- A porta **3030** não deve estar bloqueada pelo firewall do Windows.

### Liberar porta 3030 no Firewall do Windows (primeira vez)

1. Abrir **Painel de Controle → Firewall do Windows Defender → Configurações Avançadas**.
2. Clicar em **Regras de Entrada → Nova Regra**.
3. Selecionar **Porta** → Próximo.
4. **TCP**, porta específica: `3030` → Próximo.
5. **Permitir a conexão** → Próximo → Próximo.
6. Nome: `Rayzen PDV Garcom` → Concluir.

---

## Verificando se o servidor está ativo

Na barra de status do PDV (canto superior direito) aparece um chip:

```
Garçom · http://192.168.1.100:3030
```

Esse é o endereço que os garçons devem digitar no navegador.

Se o chip **não aparecer**, verifique:
- O app foi reiniciado após a última atualização?
- O computador tem IP local atribuído (não está em modo avião)?

---

## Estrutura de arquivos relevantes

```
electron/
  preload.cjs                        ← expõe waiter.getStatus() ao renderer
  src/
    contracts/
      ipc.ts                         ← IPC_CHANNELS.waiterGetStatus + WaiterServerStatusSnapshot
      preload.ts                     ← RayzenDesktopApi.waiter namespace
    preload-api.ts                   ← implementa waiter.getStatus() via IPC
    main/
      ipc-server.ts                  ← registra handler waiterGetStatus
      runtime.ts                     ← instancia e gerencia ciclo de vida do WaiterHttpServer
      waiter/
        http-server.ts               ← servidor HTTP Node (porta 3030)
        session-store.ts             ← sessões in-memory com TTL 8h
        mobile-ui.ts                 ← HTML/CSS/JS da interface do garçom

apps/pdv/src/
  infra/
    desktop-api.ts                   ← WaiterServerStatusSnapshot + waiter namespace
    desktop-bridge.ts                ← getWaiterStatus()
  application/
    types.ts                         ← DesktopBridge.getWaiterStatus()
    shell-controller.ts              ← carrega waiterUrl no bootstrap
  domain/
    shell-state.ts                   ← waiterUrl no ShellState + evento waiter-status-loaded
  ui/
    view.ts                          ← chip "Garçom" na status bar
```

---

## Deploy após alterações

Depois de qualquer mudança nos arquivos acima, execute:

```bash
# 1. Compilar todo o workspace
pnpm build

# 2. Copiar arquivos compilados para o asar extraído
PROJ="caminho/para/Rayzen-PDV"
EXTRACTED="$PROJ/electron/out/app-asar-extracted"

cp -r "$PROJ/electron/dist/."          "$EXTRACTED/dist/"
cp    "$PROJ/electron/preload.cjs"     "$EXTRACTED/preload.cjs"
cp -r "$PROJ/packages/db/dist/."       "$EXTRACTED/node_modules/@rayzen/db/dist/"
cp -r "$PROJ/apps/pdv/dist/."          "$EXTRACTED/node_modules/@rayzen/pdv/dist/"

# 3. Copiar renderer
RENDERER="$PROJ/electron/out/Rayzen PDV-win32-x64/resources/renderer"
cp -r "$PROJ/apps/pdv/dist/." "$RENDERER/dist/"
cp    "$PROJ/apps/pdv/shell.css" "$RENDERER/shell.css"

# 4. Reempacotar o asar
npx asar pack "$EXTRACTED" \
  "$PROJ/electron/out/Rayzen PDV-win32-x64/resources/app.asar"
```

O asar correto tem ~2 MB. Se ficar com 28 bytes, o caminho de origem está errado.

---

## Alterar a porta padrão (3030)

Em `electron/src/main/runtime.ts`, ao instanciar o servidor:

```typescript
const waiter = new WaiterHttpServer(auth, catalog, pdv, logger, { port: 3031 });
```

Lembre de atualizar a regra do firewall para a nova porta.

---

## Segurança

- O servidor aceita conexões de **qualquer IP** na rede local (`0.0.0.0`).
- Autenticação é obrigatória por PIN antes de qualquer operação.
- Sessões expiram em 8 horas ou ao reiniciar o app.
- **Não expor a porta 3030 para a internet.** O servidor não tem HTTPS nem autenticação robusta para uso externo.
