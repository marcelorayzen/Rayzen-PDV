export const infraLayer = {
  name: "infra",
  responsibility: "Bridge renderer concerns to IPC contracts and local adapters."
} as const;

export { createDesktopBridge } from "./desktop-bridge.js";
