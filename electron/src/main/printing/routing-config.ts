export interface PrintRoutingSetorConfig {
  id: string;
  impressoras: string[];
}

export interface PrintRoutingConfig {
  setores: PrintRoutingSetorConfig[];
}

export const DEFAULT_PRINT_ROUTING_CONFIG: PrintRoutingConfig = {
  setores: [
    {
      id: "COZINHA",
      impressoras: ["IMP_COZINHA_01"]
    },
    {
      id: "BAR",
      impressoras: ["IMP_BAR_01"]
    }
  ]
};

export function listSetorRoutes(config: PrintRoutingConfig): PrintRoutingSetorConfig[] {
  return config.setores.map((setor) => ({
    id: setor.id,
    impressoras: [...setor.impressoras]
  }));
}

export function resolvePrinterTargetsForSetor(
  config: PrintRoutingConfig,
  setorId: string
): string[] {
  const setor = config.setores.find((item) => item.id === setorId);
  return setor ? [...setor.impressoras] : [];
}
