import { PlayerEngineMode, XtreamCredentials } from '../types/iptv';

const KEYS = {
  LAST_M3U_URL: 'TVPlayer_LastM3uUrl',
  XTREAM_CREDS: 'TVPlayer_XtreamCreds',
  FAVORITE_URLS: 'TVPlayer_FavoriteUrls',
  RECENT_URLS: 'TVPlayer_RecentUrls',
  PLAYER_ENGINE: 'TVPlayer_PlayerEngine',
  PARENTAL_PIN: 'TVPlayer_ParentalPin',
  SHOW_ADULT_CONTENT: 'TVPlayer_ShowAdultContent',
};

export const DEFAULT_PARENTAL_PIN = '0000';

export const storageService = {
  getLastM3uUrl(): string {
    try {
      return localStorage.getItem(KEYS.LAST_M3U_URL) || '';
    } catch {
      return '';
    }
  },

  setLastM3uUrl(url: string): void {
    try {
      localStorage.setItem(KEYS.LAST_M3U_URL, url);
    } catch {
      // Ignorar erro de quota
    }
  },

  getXtreamCreds(): XtreamCredentials {
    try {
      const raw = localStorage.getItem(KEYS.XTREAM_CREDS);
      if (raw) return JSON.parse(raw);
    } catch {
      // Ignorar
    }
    return { serverUrl: '', username: '', password: '' };
  },

  setXtreamCreds(creds: XtreamCredentials): void {
    try {
      localStorage.setItem(KEYS.XTREAM_CREDS, JSON.stringify(creds));
    } catch {
      // Ignorar
    }
  },

  getFavorites(): string[] {
    try {
      const raw = localStorage.getItem(KEYS.FAVORITE_URLS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  toggleFavorite(channelUrl: string): string[] {
    const current = this.getFavorites();
    const exists = current.includes(channelUrl);
    const updated = exists ? current.filter((u) => u !== channelUrl) : [channelUrl, ...current];
    try {
      localStorage.setItem(KEYS.FAVORITE_URLS, JSON.stringify(updated));
    } catch {
      // Ignorar
    }
    return updated;
  },

  getRecents(): string[] {
    try {
      const raw = localStorage.getItem(KEYS.RECENT_URLS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  addRecent(channelUrl: string): string[] {
    const current = this.getRecents().filter((u) => u !== channelUrl);
    const updated = [channelUrl, ...current].slice(0, 30);
    try {
      localStorage.setItem(KEYS.RECENT_URLS, JSON.stringify(updated));
    } catch {
      // Ignorar
    }
    return updated;
  },

  getPlayerEngine(): PlayerEngineMode {
    try {
      const val = localStorage.getItem(KEYS.PLAYER_ENGINE) as PlayerEngineMode | null;
      return val || 'auto';
    } catch {
      return 'auto';
    }
  },

  setPlayerEngine(mode: PlayerEngineMode): void {
    try {
      localStorage.setItem(KEYS.PLAYER_ENGINE, mode);
    } catch {
      // Ignorar
    }
  },

  getParentalPin(): string {
    try {
      return localStorage.getItem(KEYS.PARENTAL_PIN) || DEFAULT_PARENTAL_PIN;
    } catch {
      return DEFAULT_PARENTAL_PIN;
    }
  },

  setParentalPin(newPin: string): void {
    try {
      localStorage.setItem(KEYS.PARENTAL_PIN, newPin.trim());
    } catch {
      // Ignorar
    }
  },

  getShowAdultContent(): boolean {
    try {
      return localStorage.getItem(KEYS.SHOW_ADULT_CONTENT) === 'true';
    } catch {
      return false;
    }
  },

  setShowAdultContent(show: boolean): void {
    try {
      localStorage.setItem(KEYS.SHOW_ADULT_CONTENT, show ? 'true' : 'false');
    } catch {
      // Ignorar
    }
  },
};
