"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  saveConfig: (data) => ipcRenderer.invoke("save-config", data),
  launchApp: () => ipcRenderer.invoke("launch-app"),
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  onServerCrashed: (cb) => ipcRenderer.on("server-crashed", (_e, code) => cb(code)),
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printToPrinter: (opts) => ipcRenderer.invoke("print-to-printer", opts),
});
