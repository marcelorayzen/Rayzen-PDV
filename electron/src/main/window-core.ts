import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BrowserWindowConstructorOptions } from "electron";

export interface RayzenBrowserWindowLike {
  loadFile(filePath: string): Promise<void> | void;
  on(event: string, listener: () => void): void;
  show?(): void;
  focus?(): void;
}

export interface RayzenBrowserWindowConstructor {
  new (options: BrowserWindowConstructorOptions): RayzenBrowserWindowLike;
  getAllWindows?(): RayzenBrowserWindowLike[];
}

export interface RendererAssetPathOptions {
  workspaceRoot?: string;
  rendererHtmlPath?: string;
  rendererBundleDir?: string;
  preloadScriptPath?: string;
}

export interface RendererAssetPaths {
  workspaceRoot: string;
  rendererHtmlPath: string;
  preloadScriptPath: string;
}

export interface CreateRayzenMainWindowOptions extends RendererAssetPathOptions {
  browserWindowConstructor?: RayzenBrowserWindowConstructor;
}

export interface CreatedRayzenMainWindow {
  window: RayzenBrowserWindowLike;
  paths: RendererAssetPaths;
}

export function resolveRendererAssetPaths(
  options: RendererAssetPathOptions = {}
): RendererAssetPaths {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = options.workspaceRoot ?? path.resolve(currentDir, "../../..");
  const bundledRendererHtmlPath = resolveBundledRendererHtmlPath(options);
  const preloadCandidates = [
    options.preloadScriptPath,
    path.resolve(currentDir, "../../preload.cjs"),
    path.resolve(currentDir, "../preload.js")
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);

  return {
    workspaceRoot,
    rendererHtmlPath:
      options.rendererHtmlPath ??
      bundledRendererHtmlPath ??
      path.join(workspaceRoot, "apps", "pdv", "index.html"),
    preloadScriptPath: preloadCandidates.find((candidate) => fs.existsSync(candidate)) ?? preloadCandidates[0]!
  };
}

function resolveBundledRendererHtmlPath(
  options: RendererAssetPathOptions
): string | null {
  const candidateDirs = new Set<string>();
  const configuredBundleDir = options.rendererBundleDir ?? process.env["RAYZEN_PDV_RENDERER_DIR"];

  if (configuredBundleDir) {
    candidateDirs.add(configuredBundleDir);
  }

  if (typeof process.resourcesPath === "string" && process.resourcesPath.length > 0) {
    candidateDirs.add(path.join(process.resourcesPath, "renderer"));
  }

  for (const candidateDir of candidateDirs) {
    const candidateFilePath = path.join(candidateDir, "index.html");

    if (fs.existsSync(candidateFilePath)) {
      return candidateFilePath;
    }
  }

  return null;
}

export function createConfiguredRayzenMainWindow(
  browserWindowConstructor: RayzenBrowserWindowConstructor,
  options: RendererAssetPathOptions = {}
): CreatedRayzenMainWindow {
  const paths = resolveRendererAssetPaths(options);
  const window = new browserWindowConstructor({
    width: 1440,
    height: 920,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#17130f",
    title: "Rayzen PDV",
    webPreferences: {
      preload: paths.preloadScriptPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.on("ready-to-show", () => {
    window.show?.();
  });

  void Promise.resolve(window.loadFile(paths.rendererHtmlPath));

  return {
    window,
    paths
  };
}

export function getOpenWindowCount(
  browserWindowConstructor: RayzenBrowserWindowConstructor
): number {
  return browserWindowConstructor.getAllWindows?.().length ?? 0;
}
