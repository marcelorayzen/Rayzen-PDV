import { bootstrapRayzenElectronMain } from "./main/runtime.js";

void bootstrapRayzenElectronMain().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[rayzen-pdv/electron] bootstrap failed", error);
  process.exitCode = 1;
});
