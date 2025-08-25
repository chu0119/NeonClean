const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const fsp = require('fs/promises');
const { exec } = require('child_process');

let mainWindow = null;
let scanToken = { cancelled: false };
let cleanToken = { cancelled: false };

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#0b0c10',
    titleBarStyle: 'hiddenInset',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html')).catch(() => {});
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function execPowerShell(cmd) {
  const full = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${cmd.replace(/"/g, '\\"')}"`;
  return new Promise((resolve) => {
    exec(full, { windowsHide: true, timeout: 60_000 }, (err, stdout) => {
      if (err) return resolve({ ok: false, stdout: String(stdout || '').trim(), error: String(err) });
      resolve({ ok: true, stdout: String(stdout || '').trim() });
    });
  });
}

function safeJoin(...p) {
  return path.join(...p).replace(/[/\\]+/g, path.sep);
}

const home = os.homedir();
const localAppData = process.env.LOCALAPPDATA || safeJoin(home, 'AppData', 'Local');
const appData = process.env.APPDATA || safeJoin(home, 'AppData', 'Roaming');

function getTargets() {
  return [
    // 基础临时目录
    { id: 'temp-os', label: '系统临时文件（当前会话）', type: 'safe', method: 'dir', path: os.tmpdir(), hint: '删除无用临时文件' },
    { id: 'temp-local', label: '用户临时文件（Local\\Temp）', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'Temp'), hint: '清理用户级临时目录' },

    // Chrome/Edge（默认配置文件）
    { id: 'chrome-cache', label: 'Chrome 缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'), hint: '不影响书签与登录' },
    { id: 'chrome-codecache', label: 'Chrome 代码缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache'), hint: '下次启动会自动重建' },
    { id: 'chrome-gpucache', label: 'Chrome GPU 缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'GPUCache'), hint: '下次启动会自动重建' },

    { id: 'edge-cache', label: 'Edge 缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'), hint: '不影响书签与登录' },
    { id: 'edge-codecache', label: 'Edge 代码缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache'), hint: '下次启动会自动重建' },
    { id: 'edge-gpucache', label: 'Edge GPU 缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'GPUCache'), hint: '下次启动会自动重建' },

    // Firefox
    { id: 'firefox-cache', label: 'Firefox 缓存', type: 'safe', method: 'firefoxCache', path: safeJoin(appData, 'Mozilla', 'Firefox', 'Profiles'), hint: '不影响书签与登录' },

    // Brave/Vivaldi/Opera（默认配置）
    { id: 'brave-cache', label: 'Brave 缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Cache'), hint: '不影响收藏与登录' },
    { id: 'brave-codecache', label: 'Brave 代码缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Code Cache'), hint: '下次启动会自动重建' },
    { id: 'brave-gpucache', label: 'Brave GPU 缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'GPUCache'), hint: '下次启动会自动重建' },

    { id: 'vivaldi-cache', label: 'Vivaldi 缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'Vivaldi', 'User Data', 'Default', 'Cache'), hint: '不影响收藏与登录' },
    { id: 'vivaldi-codecache', label: 'Vivaldi 代码缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'Vivaldi', 'User Data', 'Default', 'Code Cache'), hint: '下次启动会自动重建' },
    { id: 'vivaldi-gpucache', label: 'Vivaldi GPU 缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'Vivaldi', 'User Data', 'Default', 'GPUCache'), hint: '下次启动会自动重建' },

    { id: 'opera-cache', label: 'Opera 缓存', type: 'safe', method: 'dir', path: safeJoin(appData, 'Opera Software', 'Opera Stable', 'Cache'), hint: '不影响收藏与登录' },
    { id: 'opera-codecache', label: 'Opera 代码缓存', type: 'safe', method: 'dir', path: safeJoin(appData, 'Opera Software', 'Opera Stable', 'Code Cache'), hint: '下次启动会自动重建' },
    { id: 'opera-gpucache', label: 'Opera GPU 缓存', type: 'safe', method: 'dir', path: safeJoin(appData, 'Opera Software', 'Opera Stable', 'GPUCache'), hint: '下次启动会自动重建' },

    // VS Code
    { id: 'vscode-cache', label: 'VS Code 缓存', type: 'safe', method: 'dir', path: safeJoin(appData, 'Code', 'Cache'), hint: '不影响扩展、设置' },
    { id: 'vscode-cacheddata', label: 'VS Code CachedData', type: 'safe', method: 'dir', path: safeJoin(appData, 'Code', 'CachedData'), hint: '不影响扩展、设置' },
    { id: 'vscode-gpucache', label: 'VS Code GPU 缓存', type: 'safe', method: 'dir', path: safeJoin(appData, 'Code', 'GPUCache'), hint: '不影响扩展、设置' },
    { id: 'vscode-swcache', label: 'VS Code Service Worker 缓存', type: 'safe', method: 'dir', path: safeJoin(appData, 'Code', 'Service Worker', 'CacheStorage'), hint: '不影响扩展、设置' },

    // Discord
    { id: 'discord-cache', label: 'Discord 缓存', type: 'safe', method: 'dir', path: safeJoin(appData, 'discord', 'Cache'), hint: '不影响账号与群组' },
    { id: 'discord-codecache', label: 'Discord 代码缓存', type: 'safe', method: 'dir', path: safeJoin(appData, 'discord', 'Code Cache'), hint: '下次启动会自动重建' },
    { id: 'discord-gpucache', label: 'Discord GPU 缓存', type: 'safe', method: 'dir', path: safeJoin(appData, 'discord', 'GPUCache'), hint: '下次启动会自动重建' },
    { id: 'discord-swcache', label: 'Discord Service Worker 缓存', type: 'safe', method: 'dir', path: safeJoin(appData, 'discord', 'Service Worker', 'CacheStorage'), hint: '不影响账号与群组' },

    // 开发者包管理缓存
    { id: 'npm-cache', label: 'npm 缓存', type: 'safe', method: 'dir', path: safeJoin(appData, 'npm-cache'), hint: '会自动重建，首次安装包稍慢' },
    { id: 'yarn-cache', label: 'Yarn 缓存', type: 'safe', method: 'dir', path: safeJoin(localAppData, 'Yarn', 'Cache'), hint: '会自动重建，首次安装包稍慢' },
    { id: 'pnpm-store', label: 'pnpm 存储(store)', type: 'optional', method: 'dir', path: safeJoin(localAppData, 'pnpm', 'store'), hint: '会自动重建；如项目多会较大' },
    { id: 'pnpm-store-v3', label: 'pnpm 存储(store-v3)', type: 'optional', method: 'dir', path: safeJoin(localAppData, 'pnpm', 'store-v3'), hint: '会自动重建；如项目多会较大' },

    // 回收站
    { id: 'recycle-bin', label: '回收站', type: 'safe', method: 'recycle', hint: '清空所有磁盘回收站' },

    // 系统缩略图缓存
    { id: 'thumbcache', label: 'Windows 缩略图缓存', type: 'safe', method: 'pattern', path: safeJoin(localAppData, 'Microsoft', 'Windows', 'Explorer'), pattern: /^thumbcache.*\.db$/i, hint: '系统会自动重建，首次打开图片夹可能略慢' },

    // Windows 更新与系统级缓存（可能需要管理员权限）
    { id: 'winupdate', label: 'Windows 更新缓存', type: 'optional', method: 'dir', path: 'C:\\Windows\\SoftwareDistribution\\Download', hint: '可节省磁盘，可能需管理员权限' },
    { id: 'delivery-opt', label: 'Windows 交付优化缓存', type: 'optional', method: 'dir', path: 'C:\\Windows\\SoftwareDistribution\\DeliveryOptimization', hint: 'P2P 更新缓存，可能需管理员权限' },
    { id: 'wer', label: 'Windows 错误报告 (WER)', type: 'optional', method: 'dir', path: 'C:\\ProgramData\\Microsoft\\Windows\\WER', hint: '错误报告与转储，可能需管理员权限' },
    { id: 'prefetch', label: '系统 Prefetch', type: 'optional', method: 'dir', path: 'C:\\Windows\\Prefetch', hint: 'Windows 会再生成，可能需要管理员权限' }
  ];
}

async function getDirSize(target, token) {
  const dir = target;
  try {
    const stat = await fsp.stat(dir);
    if (!stat.isDirectory()) return stat.size || 0;
  } catch {
    return 0;
  }
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    if (token.cancelled) throw new Error('cancelled');
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (token.cancelled) throw new Error('cancelled');
      const p = path.join(current, ent.name);
      try {
        const st = await fsp.lstat(p);
        if (st.isSymbolicLink()) continue;
        if (st.isDirectory()) {
          stack.push(p);
        } else {
          total += st.size || 0;
        }
      } catch {
        // ignore
      }
    }
  }
  return total;
}

async function sizeFirefoxCache(baseDir, token) {
  try {
    const list = await fsp.readdir(baseDir, { withFileTypes: true });
    let total = 0;
    for (const ent of list) {
      if (token.cancelled) throw new Error('cancelled');
      if (!ent.isDirectory()) continue;
      const cache2 = path.join(baseDir, ent.name, 'cache2');
      total += await getDirSize(cache2, token);
    }
    return total;
  } catch {
    return 0;
  }
}

async function sizeThumbcacheFiles(dir, token, pattern) {
  try {
    const list = await fsp.readdir(dir, { withFileTypes: true });
    let total = 0;
    for (const ent of list) {
      if (token.cancelled) throw new Error('cancelled');
      if (!ent.isFile()) continue;
      if (pattern.test(ent.name)) {
        try {
          const st = await fsp.stat(path.join(dir, ent.name));
          total += st.size || 0;
        } catch {}
      }
    }
    return total;
  } catch {
    return 0;
  }
}

async function getRecycleBinSize() {
  const ps = "try { $ErrorActionPreference='SilentlyContinue'; (Get-PSDrive -PSProvider FileSystem | ForEach-Object { $p = Join-Path $_.Root '$Recycle.Bin'; if (Test-Path $p) { Get-ChildItem -Force -Recurse -ErrorAction SilentlyContinue $p } } | Where-Object { -not $_.PSIsContainer } | Measure-Object -Property Length -Sum).Sum } catch { 0 }";
  const res = await execPowerShell(ps);
  if (!res.ok) return 0;
  const n = parseInt((res.stdout || '0').trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

async function scanAll(token) {
  const targets = getTargets();
  const items = [];
  for (let i = 0; i < targets.length; i++) {
    if (token.cancelled) throw new Error('cancelled');
    const t = targets[i];
    let size = 0;
    try {
      if (t.method === 'dir') {
        size = await getDirSize(t.path, token);
      } else if (t.method === 'firefoxCache') {
        size = await sizeFirefoxCache(t.path, token);
      } else if (t.method === 'pattern') {
        size = await sizeThumbcacheFiles(t.path, token, t.pattern);
      } else if (t.method === 'recycle') {
        size = await getRecycleBinSize();
      }
    } catch (e) {
      if (String(e.message || '') === 'cancelled') throw e;
      size = 0;
    }
    items.push({
      id: t.id,
      label: t.label,
      type: t.type,
      hint: t.hint,
      method: t.method,
      path: t.path || null,
      size
    });
    const percent = Math.round(((i + 1) / targets.length) * 100);
    send('scan-progress', { current: t.id, percent });
  }
  return items;
}

async function emptyDirContents(dir, token) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (token.cancelled) throw new Error('cancelled');
      const p = path.join(dir, ent.name);
      try {
        await fsp.rm(p, { recursive: true, force: true });
      } catch {
        // ignore failures (in-use, permission)
      }
    }
    // ensure root exists
    await fsp.mkdir(dir, { recursive: true }).catch(() => {});
    return true;
  } catch {
    return false;
  }
}

async function cleanFirefoxCache(baseDir, token) {
  let ok = true;
  try {
    const list = await fsp.readdir(baseDir, { withFileTypes: true });
    for (const ent of list) {
      if (token.cancelled) throw new Error('cancelled');
      if (!ent.isDirectory()) continue;
      const cache2 = path.join(baseDir, ent.name, 'cache2');
      ok = (await emptyDirContents(cache2, token)) && ok;
    }
  } catch {
    ok = false;
  }
  return ok;
}

async function cleanPatternFiles(dir, token, pattern) {
  let ok = true;
  try {
    const list = await fsp.readdir(dir, { withFileTypes: true });
    for (const ent of list) {
      if (token.cancelled) throw new Error('cancelled');
      if (!ent.isFile()) continue;
      if (pattern.test(ent.name)) {
        try {
          await fsp.rm(path.join(dir, ent.name), { force: true });
        } catch {
          ok = false;
        }
      }
    }
  } catch {
    ok = false;
  }
  return ok;
}

async function clearRecycleBin() {
  const res = await execPowerShell("try { Clear-RecycleBin -Force -ErrorAction SilentlyContinue; 'OK' } catch { 'ERR' }");
  return res.ok && (res.stdout || '').includes('OK');
}

async function performClean(selectedIds, token) {
  const all = getTargets();
  const map = new Map(all.map((t) => [t.id, t]));
  const results = [];
  let freed = 0;

  for (let i = 0; i < selectedIds.length; i++) {
    if (token.cancelled) throw new Error('cancelled');
    const id = selectedIds[i];
    const t = map.get(id);
    if (!t) continue;

    let beforeSize = 0;
    try {
      if (t.method === 'dir') {
        beforeSize = await getDirSize(t.path, token);
      } else if (t.method === 'firefoxCache') {
        beforeSize = await sizeFirefoxCache(t.path, token);
      } else if (t.method === 'pattern') {
        beforeSize = await sizeThumbcacheFiles(t.path, token, t.pattern);
      } else if (t.method === 'recycle') {
        beforeSize = await getRecycleBinSize();
      }
    } catch {}

    let ok = false;
    try {
      if (t.method === 'dir') {
        ok = await emptyDirContents(t.path, token);
      } else if (t.method === 'firefoxCache') {
        ok = await cleanFirefoxCache(t.path, token);
      } else if (t.method === 'pattern') {
        ok = await cleanPatternFiles(t.path, token, t.pattern);
      } else if (t.method === 'recycle') {
        ok = await clearRecycleBin();
      }
    } catch {
      ok = false;
    }

    let afterSize = 0;
    try {
      if (t.method === 'dir') {
        afterSize = await getDirSize(t.path, token);
      } else if (t.method === 'firefoxCache') {
        afterSize = await sizeFirefoxCache(t.path, token);
      } else if (t.method === 'pattern') {
        afterSize = await sizeThumbcacheFiles(t.path, token, t.pattern);
      } else if (t.method === 'recycle') {
        afterSize = await getRecycleBinSize();
      }
    } catch {}

    const reclaimed = Math.max(0, beforeSize - afterSize);
    freed += reclaimed;

    results.push({
      id: t.id,
      label: t.label,
      ok,
      reclaimed
    });

    const percent = Math.round(((i + 1) / selectedIds.length) * 100);
    send('clean-progress', { current: t.id, percent });
  }

  return { freed, details: results };
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.neonclean.app');
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  createWindow();

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('scan-start', async () => {
  scanToken = { cancelled: false };
  try {
    const items = await scanAll(scanToken);
    send('scan-complete', { aborted: false, items });
  } catch (e) {
    const aborted = String(e.message || '') === 'cancelled';
    send('scan-complete', { aborted, items: [] });
  }
});

ipcMain.on('scan-cancel', () => {
  scanToken.cancelled = true;
});

ipcMain.handle('clean-start', async (evt, selectedIds) => {
  if (!Array.isArray(selectedIds)) selectedIds = [];
  cleanToken = { cancelled: false };
  try {
    const res = await performClean(selectedIds, cleanToken);
    send('clean-complete', { aborted: false, ...res });
  } catch (e) {
    const aborted = String(e.message || '') === 'cancelled';
    send('clean-complete', { aborted, freed: 0, details: [] });
  }
});

ipcMain.on('clean-cancel', () => {
  cleanToken.cancelled = true;
});