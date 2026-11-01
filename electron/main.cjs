const { app, BrowserWindow, shell, ipcMain, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

// Desabilitar aceleração por software para garantir GPU real
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#141414',
    icon: path.join(__dirname, '../public/icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Libera streams IPTV externos de qualquer servidor sem CORS
      allowRunningInsecureContent: true,
    },
  });

  // Remove menu padrão do Windows
  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abrir links externos no navegador padrão do usuário
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Carrega Dev Server se estiver rodando, caso contrário carrega o build de produção
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || (process.argv.includes('--dev') ? 'http://localhost:5173/' : null);

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// Atalhos IPC (Picture-in-Picture, Fullscreen, Versão)
ipcMain.handle('app:toggle-pip', () => {
  if (!mainWindow) return false;
  const isAlwaysOnTop = mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(!isAlwaysOnTop);
  return !isAlwaysOnTop;
});

ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

// Verificação de Atualizações via GitHub Releases API
ipcMain.handle('app:check-for-updates', async () => {
  try {
    const currentVersion = app.getVersion();
    const apiUrl = 'https://api.github.com/repos/admjorgeluiz/TVPlayerMAUI/releases/latest';
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'TVPlayer-Desktop-App',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return { hasUpdate: false, currentVersion, error: `GitHub API error: ${response.status}` };
    }

    const release = await response.json();
    if (!release || !release.tag_name) {
      return { hasUpdate: false, currentVersion };
    }

    const cleanTag = release.tag_name.replace(/^[vV]/, '').trim();

    // Compara versões semânticas (ex: 2.1.0 vs 2.0.0)
    const isNewer = compareSemver(cleanTag, currentVersion) > 0;

    // Busca o asset do instalador (.exe)
    const exeAsset = Array.isArray(release.assets)
      ? release.assets.find(
          (a) =>
            typeof a.name === 'string' &&
            a.name.toLowerCase().endsWith('.exe') &&
            !a.name.toLowerCase().includes('blockmap')
        )
      : null;

    return {
      hasUpdate: isNewer && Boolean(exeAsset),
      currentVersion,
      latestVersion: cleanTag,
      tagName: release.tag_name,
      releaseName: release.name || release.tag_name,
      releaseNotes: release.body || '',
      downloadUrl: exeAsset ? exeAsset.browser_download_url : null,
      assetName: exeAsset ? exeAsset.name : null,
      assetSize: exeAsset ? exeAsset.size : null,
      publishedAt: release.published_at,
    };
  } catch (err) {
    console.error('[Electron Updater] Erro ao verificar atualizações:', err);
    return { hasUpdate: false, currentVersion: app.getVersion(), error: String(err) };
  }
});

// Download e Execução do Instalador da Atualização
ipcMain.handle('app:download-and-install-update', async (_event, downloadUrl) => {
  try {
    if (!downloadUrl) throw new Error('URL de download não informada.');

    const tempFolder = app.getPath('temp');
    const installerPath = path.join(tempFolder, 'setupTVPlayer_update.exe');

    const res = await fetch(downloadUrl, {
      headers: { 'User-Agent': 'TVPlayer-Desktop-App' },
    });

    if (!res.ok) throw new Error(`Falha no download: HTTP ${res.status}`);

    const totalBytes = Number(res.headers.get('content-length')) || 0;
    let receivedBytes = 0;

    const fileStream = fs.createWriteStream(installerPath);
    const reader = res.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(Buffer.from(value));
      receivedBytes += value.length;

      if (mainWindow && !mainWindow.isDestroyed()) {
        const percent = totalBytes > 0 ? Math.round((receivedBytes / totalBytes) * 100) : 0;
        mainWindow.webContents.send('app:update-progress', {
          percent,
          receivedBytes,
          totalBytes,
        });
      }
    }

    await new Promise((resolve) => fileStream.end(resolve));

    // Executa o instalador em processo independente e fecha o TVPlayer
    const child = spawn(installerPath, [], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    setTimeout(() => {
      app.quit();
    }, 1000);

    return { success: true };
  } catch (err) {
    console.error('[Electron Updater] Erro ao baixar/instalar atualização:', err);
    return { success: false, error: String(err) };
  }
});

function compareSemver(v1, v2) {
  const parts1 = v1.split('.').map((n) => parseInt(n, 10) || 0);
  const parts2 = v2.split('.').map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
