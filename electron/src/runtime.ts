import { bootstrapRayzenElectronMain } from "./main/runtime.js";

void bootstrapRayzenElectronMain().catch((error) => {
  console.error("[rayzen-pdv/electron] bootstrap failed", error);
  process.exitCode = 1;
});
