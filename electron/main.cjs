/* eslint-disable */
"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const net = require("net");

const IS_DEV = process.env.IS_DEV === "true";
const CONFIG_PATH = path.join(app.getPath("userData"), "tashi-config.json");

let mainWindow = null;
let setupWindow = null;
let serverPort = null;

// ── Config helpers ──────────────────────────────────────────────────────────

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch (_) {}
  return null;
}

function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function generateSecret(len = 48) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ── Find a free port ─────────────────────────────────────────────────────────

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

// ── Wait for the Express server to be healthy ─────────────────────────────────

function waitForServer(port, retries = 60, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function check() {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", retry);
      req.setTimeout(1000, () => { req.destroy(); retry(); });
    }
    function retry() {
      if (++attempts >= retries) return reject(new Error("Server did not start in time"));
      setTimeout(check, delay);
    }
    check();
  });
}

// ── Start Express server inline (dynamic import of ESM module) ────────────────

async function startServer(config) {
  serverPort = IS_DEV ? 3001 : await getFreePort();

  // Set env vars BEFORE importing the server module
  process.env.PORT = String(serverPort);
  process.env.NODE_ENV = "production";
  process.env.IS_ELECTRON = "1";
  process.env.FIREBASE_SERVICE_ACCOUNT = config.firebaseServiceAccount;
  process.env.SESSION_SECRET = config.sessionSecret;

  const serverEntry = IS_DEV
    ? path.join(__dirname, "..", "server", "index.js")
    : path.join(app.getAppPath(), "server", "index.js");

  const serverUrl = `file://${serverEntry.replace(/\\/g, "/")}`;

  console.log(`Starting API server on port ${serverPort}…`);
  console.log(`Server entry: ${serverUrl}`);

  await import(serverUrl);

  await waitForServer(serverPort);
  console.log("API server is ready.");
}

// ── Create setup window (first run / no config) ──────────────────────────────

function getIconPath() {
  if (IS_DEV) return path.join(__dirname, "..", "public", "tashi-icon.png");
  return path.join(process.resourcesPath, "public", "tashi-icon.png");
}

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 620,
    height: 640,
    resizable: false,
    center: true,
    title: "Tashi Admin — Initial Setup",
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  setupWindow.loadFile(path.join(__dirname, "setup.html"));

  if (IS_DEV) setupWindow.webContents.openDevTools({ mode: "detach" });

  setupWindow.on("closed", () => { setupWindow = null; });
}

// ── Create main admin window ──────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    center: true,
    title: "Tashi Admin",
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  const url = IS_DEV
    ? "http://localhost:5173/admin/login"
    : `http://127.0.0.1:${serverPort}/admin/login`;

  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    if (u.startsWith("http://127.0.0.1") || u.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    shell.openExternal(u);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle("save-config", async (_e, { firebaseServiceAccount, sessionSecret }) => {
  try {
    JSON.parse(firebaseServiceAccount);
  } catch {
    return { ok: false, error: "Invalid JSON — please paste the full service account JSON." };
  }
  const cfg = {
    firebaseServiceAccount,
    sessionSecret: sessionSecret || generateSecret(),
  };
  writeConfig(cfg);
  return { ok: true };
});

ipcMain.handle("launch-app", async () => {
  const config = readConfig();
  if (!config) return { ok: false, error: "No config found." };
  try {
    await startServer(config);
    if (setupWindow && !setupWindow.isDestroyed()) setupWindow.close();
    createMainWindow();
    return { ok: true };
  } catch (err) {
    console.error("Launch error:", err);
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("open-file-dialog", async () => {
  const result = await dialog.showOpenDialog(setupWindow || BrowserWindow.getFocusedWindow(), {
    title: "Select Firebase Service Account JSON",
    filters: [{ name: "JSON Files", extensions: ["json"] }],
    properties: ["openFile"],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return fs.readFileSync(result.filePaths[0], "utf8");
});

ipcMain.handle("get-app-version", () => app.getVersion());

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (IS_DEV) {
    // In dev mode, Vite handles the frontend; just open the window
    createMainWindow();
    return;
  }

  const config = readConfig();
  if (!config || !config.firebaseServiceAccount) {
    createSetupWindow();
  } else {
    try {
      await startServer(config);
      createMainWindow();
    } catch (err) {
      dialog.showErrorBox(
        "Startup Error",
        `Failed to start the Tashi Admin server:\n\n${err.message}\n\nPlease check your Firebase credentials.`
      );
      app.quit();
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (!serverPort) {
      createSetupWindow();
    } else {
      createMainWindow();
    }
  }
});
