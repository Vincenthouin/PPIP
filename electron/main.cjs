// Electron main process. Wraps the Vite-built React app in a BrowserWindow.
//
// Dev:  ELECTRON_START_URL=http://localhost:5173  electron .
// Prod: loads dist/index.html via file:// from the packaged app.

const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("node:path");

const isDev = !!process.env.ELECTRON_START_URL;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#f8fafc",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  // External links open in the default browser, not inside the app shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    win.loadURL(process.env.ELECTRON_START_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
};

app.whenReady().then(() => {
  createWindow();

  // Minimal app menu so the standard macOS shortcuts (Cmd+Q, Cmd+W, copy/paste)
  // keep working. Electron's default menu is fine; we just need it set so the
  // Edit menu items get the standard roles.
  const template = [
    ...(process.platform === "darwin"
      ? [{ role: "appMenu" }]
      : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
