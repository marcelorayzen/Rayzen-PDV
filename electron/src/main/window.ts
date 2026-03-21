import electron from "electron";

import {
  createConfiguredRayzenMainWindow,
  getOpenWindowCount as getOpenWindowCountFromCore,
  type CreateRayzenMainWindowOptions,
  type CreatedRayzenMainWindow,
  type RayzenBrowserWindowConstructor
} from "./window-core.js";

const { BrowserWindow } = electron;

export function createRayzenMainWindow(
  options: CreateRayzenMainWindowOptions = {}
): CreatedRayzenMainWindow {
  const browserWindowConstructor = options.browserWindowConstructor ?? BrowserWindow;
  return createConfiguredRayzenMainWindow(browserWindowConstructor, options);
}

export function getOpenWindowCount(
  browserWindowConstructor: RayzenBrowserWindowConstructor = BrowserWindow
): number {
  return getOpenWindowCountFromCore(browserWindowConstructor);
}
