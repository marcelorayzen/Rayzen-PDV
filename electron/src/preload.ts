import electron from "electron";

import { exposeRayzenDesktopApi } from "./preload-api.js";

const { contextBridge, ipcRenderer } = electron;

exposeRayzenDesktopApi(contextBridge, ipcRenderer);
