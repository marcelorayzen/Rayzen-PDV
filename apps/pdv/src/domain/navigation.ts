import type { OperatorRole } from "./auth.js";

export const SHELL_SHORTCUTS = {
  F2: "Abrir ou buscar comanda",
  F3: "Mapa de mesas",
  F4: "Foco na busca de produto",
  F6: "Enviar para producao",
  F7: "Pre-conta",
  F8: "Checkout",
  ESC: "Voltar ou fechar modal",
  ENTER: "Confirmar"
} as const;

export type ShortcutKey = keyof typeof SHELL_SHORTCUTS;
export type FocusTarget =
  | "setup-company-legal-name"
  | "pin-input"
  | "mesas-primary-action"
  | "product-search"
  | "comanda-numero"
  | "cancel-reason"
  | "checkout-amount"
  | "cash-opening-fund"
  | "cash-receipt-amount"
  | "cash-divergence-reason"
  | "equipe-operator-nome";

interface NavigationSeed {
  id: string;
  label: string;
  shortcut: Exclude<ShortcutKey, "ESC" | "ENTER"> | null;
  description: string;
  roles: readonly OperatorRole[];
  focusTarget: FocusTarget | null;
}

export const MAIN_NAVIGATION = [
  {
    id: "comandas",
    label: "Comandas",
    shortcut: "F2",
    description: "Abertura, retomada rapida e contexto do atendimento.",
    roles: ["CAIXA", "GARCOM", "GERENTE"],
    focusTarget: "comanda-numero"
  },
  {
    id: "mesas",
    label: "Mesas",
    shortcut: "F3",
    description: "Mapa operacional para sala e acompanhamento do turno.",
    roles: ["GARCOM", "GERENTE"],
    focusTarget: "mesas-primary-action"
  },
  {
    id: "catalogo",
    label: "Catalogo",
    shortcut: "F4",
    description: "Busca rapida de itens e atalhos para lancamento posterior.",
    roles: ["CAIXA", "GARCOM", "GERENTE"],
    focusTarget: "product-search"
  },
  {
    id: "producao",
    label: "Producao",
    shortcut: "F6",
    description: "Fila visual para envio por setor, sem logica de impressao aqui.",
    roles: ["GARCOM", "GERENTE"],
    focusTarget: null
  },
  {
    id: "preconta",
    label: "Pre-conta",
    shortcut: "F7",
    description: "Congela a visao operacional antes do checkout.",
    roles: ["CAIXA", "GARCOM", "GERENTE"],
    focusTarget: null
  },
  {
    id: "checkout",
    label: "Checkout",
    shortcut: "F8",
    description: "Entrada para pagamento e encerramento auditavel.",
    roles: ["CAIXA", "GERENTE"],
    focusTarget: "checkout-amount"
  },
  {
    id: "caixa",
    label: "Caixa",
    shortcut: null,
    description: "Abertura, fechamento e conferencias ficam neste hub.",
    roles: ["CAIXA", "GERENTE"],
    focusTarget: "cash-opening-fund"
  },
  {
    id: "equipe",
    label: "Equipe",
    shortcut: null,
    description: "Cadastro e gestao de colaboradores do terminal.",
    roles: ["GERENTE"],
    focusTarget: "equipe-operator-nome"
  }
] as const satisfies readonly NavigationSeed[];

export type MainNavigationDefinition = (typeof MAIN_NAVIGATION)[number];
export type MainViewId = MainNavigationDefinition["id"];

export interface ShortcutNavigationResult {
  viewId: MainViewId;
  focusTarget: FocusTarget | null;
  message: string;
}

export function getMainNavigationForRole(role: OperatorRole): MainNavigationDefinition[] {
  return MAIN_NAVIGATION.filter((item) => {
    return (item.roles as readonly OperatorRole[]).includes(role);
  });
}

export function getDefaultViewForRole(role: OperatorRole): MainViewId {
  const [firstView] = getMainNavigationForRole(role);
  return firstView?.id ?? "comandas";
}

export function canAccessView(role: OperatorRole, viewId: MainViewId): boolean {
  return getMainNavigationForRole(role).some((item) => item.id === viewId);
}

export function getNavigationDefinition(viewId: MainViewId): MainNavigationDefinition {
  const found = MAIN_NAVIGATION.find((item) => item.id === viewId);

  if (!found) {
    throw new Error(`Unknown main view: ${viewId}`);
  }

  return found;
}

export function resolveShortcutNavigation(
  role: OperatorRole,
  key: ShortcutKey
): ShortcutNavigationResult | null {
  if (key === "ESC" || key === "ENTER") {
    return null;
  }

  const view = getMainNavigationForRole(role).find((item) => item.shortcut === key);

  if (!view) {
    return null;
  }

  return {
    viewId: view.id,
    focusTarget: view.focusTarget,
    message: `${key} pronto: ${SHELL_SHORTCUTS[key]}.`
  };
}

export function normalizeShortcutKey(key: string): ShortcutKey | null {
  const upperKey = key.toUpperCase();

  if (upperKey === "ESCAPE") {
    return "ESC";
  }

  if (upperKey === "ENTER") {
    return "ENTER";
  }

  if (upperKey in SHELL_SHORTCUTS) {
    return upperKey as ShortcutKey;
  }

  return null;
}
