// Ponte de integração Híbrida Sênior para Samsung Tizen TV e LG webOS TV
// Funciona de forma transparente em Samsung (.wgt), LG (.ipk) e Navegador Desktop

declare global {
  interface Window {
    tizen?: any;
    webapis?: any;
    webOS?: any;
    PalmSystem?: any;
  }
}

export const TIZEN_KEYS = {
  ENTER: 13,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  BACK_TIZEN: 10009, // Botão Return / Voltar da Samsung Tizen
  BACK_WEBOS: 461, // Botão Back / Voltar da LG webOS
  BACK_BROWSER: 27, // Escape
  BACKSPACE: 8,
  PLAY_PAUSE: 10252,
  PLAY: 415,
  PAUSE: 19,
  STOP: 413,
  REWIND: 412,
  FAST_FORWARD: 417,
  CH_UP: 427,
  CH_DOWN: 428,
  PAGE_UP: 33, // CH+ na LG webOS
  PAGE_DOWN: 34, // CH- na LG webOS
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406,
  INFO: 457,
  NUM_0: 48,
  NUM_9: 57,
};

export function isTvBackKey(e: KeyboardEvent): boolean {
  return (
    e.keyCode === TIZEN_KEYS.BACK_TIZEN ||
    e.keyCode === TIZEN_KEYS.BACK_WEBOS ||
    e.key === 'Escape' ||
    e.key === 'Backspace' ||
    e.key === 'GoBack'
  );
}

export function isTvPlayPauseKey(e: KeyboardEvent): boolean {
  return (
    e.keyCode === TIZEN_KEYS.PLAY_PAUSE ||
    e.keyCode === TIZEN_KEYS.PLAY ||
    e.keyCode === TIZEN_KEYS.PAUSE ||
    e.key === 'MediaPlayPause' ||
    e.key === 'MediaPlay' ||
    e.key === 'MediaPause' ||
    e.code === 'Space'
  );
}

export function isTvRewindKey(e: KeyboardEvent): boolean {
  return (
    e.keyCode === TIZEN_KEYS.REWIND ||
    e.key === 'MediaRewind' ||
    e.key === 'MediaTrackPrevious'
  );
}

export function isTvFastForwardKey(e: KeyboardEvent): boolean {
  return (
    e.keyCode === TIZEN_KEYS.FAST_FORWARD ||
    e.key === 'MediaFastForward' ||
    e.key === 'MediaTrackNext'
  );
}

const REMOTE_KEYS_TO_REGISTER = [
  'MediaPlayPause',
  'MediaPlay',
  'MediaPause',
  'MediaStop',
  'MediaFastForward',
  'MediaRewind',
  'ChannelUp',
  'ChannelDown',
  'ColorF0Red',
  'ColorF1Green',
  'ColorF2Yellow',
  'ColorF3Blue',
  'Info',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
];

export function isTizenTV(): boolean {
  return Boolean(typeof window !== 'undefined' && (window.tizen || window.webapis));
}

export function isWebOSTV(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.webOS || window.PalmSystem) return true;
  const ua = navigator?.userAgent || '';
  return /Web0S|webOS|SmartTV.*LG|NetCast/i.test(ua);
}

export function isSmartTV(): boolean {
  if (isTizenTV() || isWebOSTV()) return true;
  if (typeof window === 'undefined') return false;
  const ua = navigator?.userAgent || '';
  return /Tizen|Web0S|webOS|SmartTV|HbbTV|VIDAA|Roku|AppleTV|Android TV|BRAVIA|Hisense/i.test(ua);
}

export function isInstalledPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as any).standalone === true ||
    window.location.search.includes('source=pwa') ||
    document.referrer.includes('android-app://')
  );
}

let cachedWebOSModel = 'LG Smart TV';
let cachedWebOSVersion = 'webOS TV';

export function initTizenTV(): void {
  if (isWebOSTV()) {
    try {
      window.webOS?.deviceInfo?.((info: any) => {
        if (info?.modelName) cachedWebOSModel = info.modelName;
        if (info?.version) cachedWebOSVersion = `webOS ${info.version}`;
      });
    } catch {
      // Ignorar
    }
    return;
  }

  if (!isTizenTV()) {
    console.info('[SmartTVBridge] Rodando em modo Web/Desktop (Simulação Híbrida Samsung/LG Ativa).');
    return;
  }

  try {
    if (window.tizen?.tvinputdevice) {
      REMOTE_KEYS_TO_REGISTER.forEach((keyName) => {
        try {
          window.tizen.tvinputdevice.registerKey(keyName);
        } catch {
          // Ignorar teclas inexistentes no controle Smart
        }
      });
    }

    setKeepScreenOn(true);
  } catch (err) {
    console.warn('[SmartTVBridge] Falha parcial ao inicializar APIs Tizen:', err);
  }
}

export function setKeepScreenOn(keepOn: boolean): void {
  try {
    if (window.webapis?.appcommon) {
      const state = keepOn
        ? window.webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF
        : window.webapis.appcommon.AppCommonScreenSaverState.SCREEN_SAVER_ON;
      window.webapis.appcommon.setScreenSaver(state, () => {}, () => {});
    }
  } catch {
    // Ignorar fora da TV Samsung
  }
}

export function exitTizenApp(): void {
  try {
    tizenAVPlay.stop();
    if (window.tizen?.application) {
      window.tizen.application.getCurrentApplication().exit();
      return;
    }
    if (window.webOS?.platformBack) {
      window.webOS.platformBack();
      return;
    }
    window.close();
  } catch (e) {
    console.warn('[SmartTVBridge] Não foi possível fechar o app nativo:', e);
  }
}

export interface TizenDeviceInfo {
  platform: string;
  model: string;
  firmware: string;
  duid: string;
  tizenVersion: string;
}

export function getDeviceInfo(): TizenDeviceInfo {
  if (isWebOSTV()) {
    return {
      platform: 'LG webOS Smart TV (Hardware)',
      model: cachedWebOSModel,
      firmware: 'Chromium webOS Engine',
      duid: 'LG-WEBOS-APP',
      tizenVersion: cachedWebOSVersion,
    };
  }

  if (!isTizenTV()) {
    return {
      platform: 'Híbrido Web (Samsung Tizen + LG webOS)',
      model: 'Smart TV Universal Build',
      firmware: 'HTML5 + HLS + MPEG-TS + AVPlay',
      duid: 'HYBRID-SMART-TV',
      tizenVersion: 'Tizen / webOS Ready',
    };
  }

  try {
    const model =
      window.webapis?.productinfo?.getRealModel?.() ||
      window.webapis?.productinfo?.getModel?.() ||
      'Samsung TV';
    const firmware = window.webapis?.productinfo?.getFirmware?.() || 'N/A';
    const duid = window.webapis?.productinfo?.getDuid?.() || 'N/A';
    const tizenVersion =
      window.tizen?.systeminfo?.getCapability?.('http://tizen.org/feature/platform.version') ||
      'Tizen OS';

    return {
      platform: 'Samsung Tizen TV (Hardware)',
      model,
      firmware,
      duid,
      tizenVersion,
    };
  } catch {
    return {
      platform: 'Samsung Tizen TV',
      model: 'Smart TV',
      firmware: '-',
      duid: '-',
      tizenVersion: '-',
    };
  }
}

// Controlador Sênior para o decodificador de hardware nativo Samsung AVPlay
export const tizenAVPlay = {
  isAvailable(): boolean {
    return Boolean(typeof window !== 'undefined' && window.webapis?.avplay);
  },

  updateDisplayArea(isFullScreen: boolean): void {
    if (!this.isAvailable()) return;
    try {
      const avplay = window.webapis.avplay;
      const state = avplay.getState?.();
      if (!state || state === 'NONE') return;

      const scaleX = 1920 / (window.innerWidth || 1920);

      if (isFullScreen) {
        avplay.setDisplayRect(0, 0, 1920, 1080);
      } else {
        const sidebarWidth = Math.round(490 * scaleX);
        avplay.setDisplayRect(sidebarWidth, 0, Math.max(100, 1920 - sidebarWidth), 1080);
      }
    } catch {
      // Ignorar se o player ainda estiver em transição
    }
  },

  activeSeekRetryTimer: null as any,

  getVideoResolutionLabel(): string | null {
    if (!this.isAvailable()) return null;
    try {
      const info = window.webapis?.avplay?.getCurrentStreamInfo?.();
      if (Array.isArray(info)) {
        for (const track of info) {
          if (track?.type === 'VIDEO' && track.extra_info) {
            const parsed =
              typeof track.extra_info === 'string'
                ? JSON.parse(track.extra_info)
                : track.extra_info;
            const rawHeight =
              parsed?.Height ||
              parsed?.height ||
              (typeof parsed?.Resolution === 'string'
                ? parsed.Resolution.split('x')[1]
                : 0);
            const h = Number(rawHeight);
            if (Number.isFinite(h) && h > 0) {
              return `${h}p`;
            }
          }
        }
      }
    } catch {
      // Ignorar se stream info ainda não estiver disponível
    }
    return null;
  },

  play(
    url: string,
    isFullScreen: boolean,
    callbacks?: {
      onBufferingStart?: () => void;
      onBufferingComplete?: () => void;
      onError?: (err: string) => void;
      onTimeUpdate?: (currentTimeSec: number, durationSec: number) => void;
      onStreamCompleted?: () => void;
    }
  ): boolean {
    if (!this.isAvailable()) return false;
    try {
      if (this.activeSeekRetryTimer) {
        clearInterval(this.activeSeekRetryTimer);
        this.activeSeekRetryTimer = null;
      }
      const avObj = document.getElementById('av-player');
      if (avObj) avObj.style.display = 'block';
      document.body.classList.add('avplay-hardware-active');

      const avplay = window.webapis.avplay;
      try {
        avplay.stop();
      } catch {}
      try {
        avplay.close();
      } catch {}

      avplay.open(url);

      try {
        avplay.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', 2);
        avplay.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', 4);
      } catch {}

      this.updateDisplayArea(isFullScreen);
      try {
        avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO');
      } catch {}

      avplay.setListener({
        onbufferingstart: () => callbacks?.onBufferingStart?.(),
        onbufferingprogress: () => {},
        onbufferingcomplete: () => callbacks?.onBufferingComplete?.(),
        oncurrentplaytime: (currentTimeMs: number) => {
          const durationMs = avplay.getDuration?.() || 0;
          callbacks?.onTimeUpdate?.(currentTimeMs / 1000, durationMs / 1000);
        },
        onstreamcompleted: () => {
          callbacks?.onStreamCompleted?.();
        },
        onevent: () => {},
        onerror: (eventType: string) => {
          callbacks?.onError?.(`AVPlay Hardware: ${eventType}`);
        },
      });

      avplay.prepareAsync(
        () => {
          try {
            this.updateDisplayArea(isFullScreen);
            avplay.play();
            callbacks?.onBufferingComplete?.();
          } catch (playErr: any) {
            callbacks?.onError?.(String(playErr?.message || playErr));
          }
        },
        (err: any) => {
          callbacks?.onError?.(String(err?.message || err || 'Stream offline ou codec inválido'));
        }
      );
      return true;
    } catch (err: any) {
      callbacks?.onError?.(String(err?.message || err));
      return false;
    }
  },

  stop(): void {
    try {
      document.body.classList.remove('avplay-hardware-active');
      const avObj = document.getElementById('av-player');
      if (avObj) avObj.style.display = 'none';
      if (window.webapis?.avplay) {
        try {
          window.webapis.avplay.stop();
        } catch {}
        try {
          window.webapis.avplay.close();
        } catch {}
      }
    } catch {
      // Ignorar
    }
  },

  togglePause(): boolean {
    if (!this.isAvailable()) return false;
    try {
      const state = window.webapis.avplay.getState();
      if (state === 'PLAYING') {
        window.webapis.avplay.pause();
        return false;
      } else if (state === 'PAUSED') {
        window.webapis.avplay.play();
        return true;
      }
    } catch {
      // Ignorar
    }
    return true;
  },

  seekTo(seconds: number, onSuccess?: () => void, onError?: (err: any) => void): boolean {
    if (!this.isAvailable()) return false;
    try {
      if (this.activeSeekRetryTimer) {
        clearInterval(this.activeSeekRetryTimer);
        this.activeSeekRetryTimer = null;
      }
      const ms = Math.max(0, Math.floor(seconds * 1000));
      const state = window.webapis.avplay.getState?.();

      // No Samsung Tizen AVPlay, seekTo exige estado PLAYING ou PAUSED.
      // Se ainda estiver em READY (durante preparação do stream), aguarda o estado estabilizar.
      if (state !== 'PLAYING' && state !== 'PAUSED') {
        let attempts = 0;
        this.activeSeekRetryTimer = setInterval(() => {
          attempts++;
          try {
            const curState = window.webapis.avplay.getState?.();
            if (curState === 'PLAYING' || curState === 'PAUSED') {
              clearInterval(this.activeSeekRetryTimer);
              this.activeSeekRetryTimer = null;
              window.webapis.avplay.seekTo(
                ms,
                () => onSuccess?.(),
                (err: any) => onError?.(err)
              );
            } else if (attempts >= 25) {
              clearInterval(this.activeSeekRetryTimer);
              this.activeSeekRetryTimer = null;
              onError?.('AVPlay seek timeout waiting for PLAYING state');
            }
          } catch (retryErr) {
            clearInterval(this.activeSeekRetryTimer);
            this.activeSeekRetryTimer = null;
            onError?.(retryErr);
          }
        }, 150);
        return true;
      }

      window.webapis.avplay.seekTo(
        ms,
        () => onSuccess?.(),
        (err: any) => onError?.(err)
      );
      return true;
    } catch (err) {
      onError?.(err);
      return false;
    }
  },
};
