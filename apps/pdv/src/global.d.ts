import type { RayzenDesktopApi } from "./infra/desktop-api.js";

declare global {
  interface Window {
    rayzenDesktop?: RayzenDesktopApi;
  }
}

export {};
