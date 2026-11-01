export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  tagName: string;
  releaseName: string;
  releaseNotes: string;
  downloadUrl: string | null;
  assetName: string | null;
  assetSize: number | null;
  publishedAt?: string;
  error?: string;
}

export interface UpdateProgress {
  percent: number;
  receivedBytes: number;
  totalBytes: number;
}

export const CURRENT_APP_VERSION = '2.0.0';

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      togglePip: () => Promise<boolean>;
      getVersion: () => Promise<string>;
      checkForUpdates: () => Promise<UpdateInfo>;
      downloadAndInstallUpdate: (url: string) => Promise<{ success: boolean; error?: string }>;
      onUpdateProgress: (cb: (progress: UpdateProgress) => void) => () => void;
    };
  }
}

function compareSemver(v1: string, v2: string): number {
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

export async function checkAppUpdates(): Promise<UpdateInfo> {
  // Se estiver no Electron, usa o handler nativo que tem acesso irrestrito
  if (window.electronAPI?.checkForUpdates) {
    try {
      return await window.electronAPI.checkForUpdates();
    } catch (err) {
      console.warn('[UpdateService] Erro via Electron API, tentando fetch web:', err);
    }
  }

  // Fallback Web / PWA / Smart TV
  try {
    const res = await fetch('https://api.github.com/repos/admjorgeluiz/TVPlayerMAUI/releases/latest', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      return {
        hasUpdate: false,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: CURRENT_APP_VERSION,
        tagName: CURRENT_APP_VERSION,
        releaseName: '',
        releaseNotes: '',
        downloadUrl: null,
        assetName: null,
        assetSize: null,
        error: `HTTP ${res.status}`,
      };
    }

    const release = await res.json();
    const cleanTag = (release.tag_name || '').replace(/^[vV]/, '').trim();
    const isNewer = compareSemver(cleanTag, CURRENT_APP_VERSION) > 0;

    const exeAsset = Array.isArray(release.assets)
      ? release.assets.find(
          (a: { name?: string }) =>
            typeof a.name === 'string' &&
            a.name.toLowerCase().endsWith('.exe') &&
            !a.name.toLowerCase().includes('blockmap')
        )
      : null;

    return {
      hasUpdate: isNewer,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: cleanTag,
      tagName: release.tag_name || cleanTag,
      releaseName: release.name || release.tag_name,
      releaseNotes: release.body || '',
      downloadUrl: exeAsset ? exeAsset.browser_download_url : (release.html_url || null),
      assetName: exeAsset ? exeAsset.name : null,
      assetSize: exeAsset ? exeAsset.size : null,
      publishedAt: release.published_at,
    };
  } catch (err) {
    console.error('[UpdateService] Erro ao consultar releases:', err);
    return {
      hasUpdate: false,
      currentVersion: CURRENT_APP_VERSION,
      latestVersion: CURRENT_APP_VERSION,
      tagName: CURRENT_APP_VERSION,
      releaseName: '',
      releaseNotes: '',
      downloadUrl: null,
      assetName: null,
      assetSize: null,
      error: String(err),
    };
  }
}
