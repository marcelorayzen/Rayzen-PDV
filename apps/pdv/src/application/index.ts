export const applicationLayer = {
  name: "application",
  responsibility: "Coordinate renderer use cases and IPC-facing application services."
} as const;

export {
  PdvShellController,
  createPdvShellController
} from "./shell-controller.js";
export type {
  ShellControllerDependencies,
  ShellStateListener
} from "./shell-controller.js";
export type { DesktopBridge } from "./types.js";
