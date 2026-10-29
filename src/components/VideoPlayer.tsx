import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { QRCodeSVG } from 'qrcode.react';
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Star,
  Tv,
  Volume2,
  VolumeX,
  AlertTriangle,
  Cpu,
  Smartphone,
  QrCode,
  Sparkles,
  SkipForward,
  SkipBack,
} from 'lucide-react';
import { Channel, PlaybackProgress, PlayerEngineMode } from '../types/iptv';
import { isTizenTV, isWebOSTV, tizenAVPlay } from '../services/tizenBridge';
import { detectLanServerBaseUrl } from '../services/pairingService';
import { storageService } from '../services/storageService';
import { isVodCompleted } from '../utils/seriesResolver';

export interface VideoPlayerRef {
  togglePlayPause: () => void;
  seekDelta: (seconds: number) => void;
  showOsd: () => void;
  hideOsd: () => void;
  isOsdVisible: () => boolean;
  isVod: () => boolean;
  handleDpadNavigation: (key: string) => boolean;
}

interface VideoPlayerProps {
  channel: Channel | null;
  totalChannelsCount: number;
  totalGroupsCount: number;
  pairingCode: string;
  lastWatchedChannel?: Channel | null;
  nextEpisode?: Channel | null;
  isStageFocused?: boolean;
  isFullScreen: boolean;
  isFavorite: boolean;
  engineMode: PlayerEngineMode;
  numericBuffer: string;
  onToggleFullScreen: () => void;
  onToggleFavorite: () => void;
  onChannelStep: (delta: number) => void;
  onSwitchEngine: () => void;
  onOpenSettingsModal: () => void;
  onLoadDemoChannels: () => void;
  onSelectLastChannel?: (ch: Channel) => void;
  onSelectNextEpisode?: (ch: Channel) => void;
  onProgressUpdate?: (progress: PlaybackProgress) => void;
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '00:00';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function classifyIptvUrl(url: string): 'hls' | 'mpegts' | 'vod_container' {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.m3u8') || url.toLowerCase().includes('m3u8')) {
    return 'hls';
  }
  if (
    /\.(mp4|mkv|avi|mov|webm)$/i.test(clean) ||
    clean.includes('/movie/') ||
    clean.includes('/series/')
  ) {
    return 'vod_container';
  }
  return 'mpegts';
}

function tryConvertXtreamToHls(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.pathname.endsWith('.ts')) {
      u.pathname = u.pathname.replace(/\.ts$/i, '.m3u8');
      return u.toString();
    }
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 3 && /^\d+$/.test(parts[2])) {
      u.pathname = `/live/${parts[0]}/${parts[1]}/${parts[2]}.m3u8`;
      return u.toString();
    }
    if (parts.length === 4 && parts[0] === 'live' && /^\d+$/.test(parts[3])) {
      u.pathname = `/live/${parts[1]}/${parts[2]}/${parts[3]}.m3u8`;
      return u.toString();
    }
  } catch {
    // Ignorar
  }
  return null;
}

export function getPlatformDisplayName(): string {
  if (isWebOSTV()) return 'LG webOS';
  if (isTizenTV()) return 'Samsung Tizen';
  return 'Web / PC';
}

export function formatPlatformError(
  errorType: 'mpegts' | 'hls' | 'direct_codec' | 'html5_error' | 'avplay',
  streamUrl: string,
  extraDetail?: string
): string {
  const platform = getPlatformDisplayName();
  const urlSnippet = streamUrl ? streamUrl.split('?')[0].split('/').slice(-2).join('/') : '';

  if (isWebOSTV()) {
    switch (errorType) {
      case 'mpegts':
      case 'direct_codec':
        return `[LG webOS] Não foi possível decodificar este canal (${urlSnippet || 'MPEG-TS'}). O servidor IPTV não autorizou o streaming ou o codec de vídeo/áudio é incompatível com o webOS. Detalhe: ${extraDetail || 'formato recusado'}.`;
      case 'hls':
        return `[LG webOS] Erro no stream HLS (${urlSnippet}). O canal parece offline ou com instabilidade na transmissão.`;
      default:
        return `[LG webOS] O canal não pôde ser reproduzido pela TV LG (${extraDetail || 'formato de stream recusado ou link offline'}).`;
    }
  }

  if (isTizenTV()) {
    switch (errorType) {
      case 'mpegts':
      case 'avplay':
        return `[Samsung Tizen] Falha na reprodução via decodificador AVPlay (${urlSnippet}). O canal pode estar offline no servidor ou o codec é incompatível com o Tizen. Detalhe: ${extraDetail || 'erro no decodificador'}.`;
      case 'hls':
        return `[Samsung Tizen] Erro no stream HLS (${urlSnippet}). Canal offline ou temporariamente fora do ar.`;
      default:
        return `[Samsung Tizen] O canal não pôde ser reproduzido pelo motor da TV Samsung (${extraDetail || 'canal offline'}).`;
    }
  }

  // Navegador / Desktop / PC
  switch (errorType) {
    case 'mpegts':
      return `[Navegador PC] Bloqueio de CORS/MPEG-TS: Este canal transmite em MPEG-TS bruto sem autorização CORS para navegadores de PC. Em Smart TVs (Samsung / LG), o decodificador nativo é acionado automaticamente.`;
    case 'hls':
      return `[Navegador PC] Erro HLS: O servidor da lista não possui cabeçalho CORS ou o canal está offline.`;
    default:
      return `[Navegador PC] Formato não suportado diretamente pelo navegador (${extraDetail || 'exige decodificador nativo da Smart TV'}).`;
  }
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>((
  {
    channel,
    totalChannelsCount,
    totalGroupsCount,
    pairingCode,
    lastWatchedChannel,
    nextEpisode,
    isStageFocused,
    isFullScreen,
    isFavorite,
    engineMode,
    numericBuffer,
    onToggleFullScreen,
    onToggleFavorite,
    onChannelStep,
    onSwitchEngine,
    onOpenSettingsModal,
    onLoadDemoChannels,
    onSelectLastChannel,
    onSelectNextEpisode,
    onProgressUpdate,
  },
  ref
) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const osdTimerRef = useRef<number | null>(null);

  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolutionLabel, setResolutionLabel] = useState<string>('');
  const [activeEngineName, setActiveEngineName] = useState<string>('Auto Engine');
  const [usingHardwareAVPlay, setUsingHardwareAVPlay] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showOsd, setShowOsd] = useState(true);
  const [controlFocusIndex, setControlFocusIndex] = useState<number>(1);
  const [retryCount, setRetryCount] = useState(0);
  const [lanBaseUrl, setLanBaseUrl] = useState('https://admjorgeluiz.github.io/tv');

  const [resumeToast, setResumeToast] = useState<{ time: number; formatted: string } | null>(null);
  const resumeToastTimerRef = useRef<number | null>(null);
  const savedProgressRef = useRef<PlaybackProgress | null>(null);
  const hasAttemptedResumeRef = useRef<boolean>(false);
  const lastSavedWallClockRef = useRef<number>(0);
  const latestPlaybackStateRef = useRef<{ url: string; currentTime: number; duration: number }>({
    url: '',
    currentTime: 0,
    duration: 0,
  });

  // Controle de seek contínuo e fluidez da timeline estilo Netflix
  const pendingSeekTargetRef = useRef<number | null>(null);
  const seekDebounceTimerRef = useRef<number | null>(null);
  const seekLockUntilRef = useRef<number>(0);
  const holdIntervalRef = useRef<number | null>(null);
  const [scrubPreview, setScrubPreview] = useState<{ time: number; delta: number } | null>(null);
  const scrubTimeoutRef = useRef<number | null>(null);
  const consecutiveSeekCountRef = useRef<number>(0);
  const lastSeekTimestampRef = useRef<number>(0);
  const timelineTrackRef = useRef<HTMLDivElement | null>(null);
  const autoNextEpisodeTimerRef = useRef<number | null>(null);
  const countdownTargetTimeRef = useRef<number | null>(null);
  const isNavigatingNextEpRef = useRef<boolean>(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);

  // Função protegida contra cliques duplicados para avançar ao próximo episódio
  const handleTriggerNextEpisode = useCallback(() => {
    if (!nextEpisode || isNavigatingNextEpRef.current) return;
    isNavigatingNextEpRef.current = true;
    if (autoNextEpisodeTimerRef.current) {
      clearInterval(autoNextEpisodeTimerRef.current);
      autoNextEpisodeTimerRef.current = null;
    }
    setAutoNextCountdown(null);

    // Marca o episódio atual como concluído
    if (channel?.url) {
      const completedProg: PlaybackProgress = {
        url: channel.url,
        currentTime: 0,
        duration: Math.floor(duration),
        percentage: 100,
        completed: true,
        updatedAt: Date.now(),
      };
      storageService.savePlaybackProgress(completedProg);
      onProgressUpdate?.(completedProg);
    }

    onSelectNextEpisode?.(nextEpisode);

    // Desbloqueia após 1.2s para evitar cliques múltiplos acidentais
    setTimeout(() => {
      isNavigatingNextEpRef.current = false;
    }, 1200);
  }, [nextEpisode, channel?.url, duration, onProgressUpdate, onSelectNextEpisode]);

  useEffect(() => {
    savedProgressRef.current =
      channel?.playbackProgress ||
      (channel?.url ? storageService.getPlaybackProgress(channel.url) : null);
    hasAttemptedResumeRef.current = false;
    setResumeToast(null);
    if (resumeToastTimerRef.current) {
      window.clearTimeout(resumeToastTimerRef.current);
    }
  }, [channel?.url, channel?.playbackProgress]);

  const applyResumeIfEligible = (targetDuration?: number) => {
    if (hasAttemptedResumeRef.current) return;
    const saved =
      savedProgressRef.current ||
      (channel?.url ? storageService.getPlaybackProgress(channel.url) : null);
    if (!saved || saved.completed || saved.currentTime < 10) return;

    if (targetDuration && targetDuration > 30) {
      if (isVodCompleted(saved.currentTime, targetDuration)) {
        return;
      }
    }

    const resumeSec = saved.currentTime;

    if (usingHardwareAVPlay) {
      const ok = tizenAVPlay.seekTo(resumeSec, () => {
        hasAttemptedResumeRef.current = true;
      });
      if (ok) {
        hasAttemptedResumeRef.current = true;
      }
    } else if (videoRef.current) {
      try {
        videoRef.current.currentTime = resumeSec;
        hasAttemptedResumeRef.current = true;
      } catch {
        // Se a mídia ainda não estiver em estado seekable, aguarda canplay / timeupdate
        return;
      }
    }

    setResumeToast({
      time: resumeSec,
      formatted: formatTime(resumeSec),
    });

    if (resumeToastTimerRef.current) {
      window.clearTimeout(resumeToastTimerRef.current);
    }
    resumeToastTimerRef.current = window.setTimeout(() => {
      setResumeToast(null);
    }, 6000);
  };

  const handleProgressTick = (cur: number, dur: number) => {
    if (Date.now() > seekLockUntilRef.current) {
      setCurrentTime(cur);
      pendingSeekTargetRef.current = null;
    }
    setDuration(dur);

    // Se estiver no Samsung AVPlay e a resolução ainda não foi capturada, consulta agora
    if (usingHardwareAVPlay && !resolutionLabel) {
      const detectedRes = tizenAVPlay.getVideoResolutionLabel();
      if (detectedRes) setResolutionLabel(detectedRes);
    }

    if (!channel?.url) return;
    latestPlaybackStateRef.current = { url: channel.url, currentTime: cur, duration: dur };

    // Verificação de segurança: se o vídeo começou perto do início (< 4s), há tempo salvo >= 10s e ainda não retomou
    if (!hasAttemptedResumeRef.current) {
      const saved =
        savedProgressRef.current ||
        storageService.getPlaybackProgress(channel.url);
      if (saved && !saved.completed && saved.currentTime >= 10) {
        const durValid = Number.isFinite(dur) && dur > 30;
        const isNotCompleted = !durValid || !isVodCompleted(saved.currentTime, dur);
        if (cur < 4 && isNotCompleted) {
          hasAttemptedResumeRef.current = true;
          if (usingHardwareAVPlay) {
            tizenAVPlay.seekTo(saved.currentTime);
          } else if (videoRef.current) {
            try {
              videoRef.current.currentTime = saved.currentTime;
            } catch {}
          }
          setResumeToast({
            time: saved.currentTime,
            formatted: formatTime(saved.currentTime),
          });
          if (resumeToastTimerRef.current) {
            window.clearTimeout(resumeToastTimerRef.current);
          }
          resumeToastTimerRef.current = window.setTimeout(() => {
            setResumeToast(null);
          }, 6000);
        }
      }
    }

    const isVod = Number.isFinite(dur) && dur > 60 && dur < 86400;
    if (!isVod) return;

    // Regra de descarte rápido: menos de 10 segundos = zapeada/engano, não polui histórico
    if (cur < 10) return;

    const now = Date.now();
    const isCompleted = isVodCompleted(cur, dur);

    if (isCompleted || now - lastSavedWallClockRef.current >= 4000) {
      lastSavedWallClockRef.current = now;
      const pct = Math.min(100, Math.round((cur / dur) * 100));
      const prog: PlaybackProgress = {
        url: channel.url,
        currentTime: isCompleted ? 0 : Math.floor(cur),
        duration: Math.floor(dur),
        percentage: isCompleted ? 100 : pct,
        completed: isCompleted,
        updatedAt: now,
      };
      storageService.savePlaybackProgress(prog);
      onProgressUpdate?.(prog);
    }
  };

  const flushProgressOnExit = () => {
    const state = latestPlaybackStateRef.current;
    if (!state.url) return;
    const { url, currentTime: cur, duration: dur } = state;
    const isVod = Number.isFinite(dur) && dur > 60 && dur < 86400;
    if (!isVod || cur < 10) return;

    const isCompleted = isVodCompleted(cur, dur);
    const pct = Math.min(100, Math.round((cur / dur) * 100));
    const prog: PlaybackProgress = {
      url,
      currentTime: isCompleted ? 0 : Math.floor(cur),
      duration: Math.floor(dur),
      percentage: isCompleted ? 100 : pct,
      completed: isCompleted,
      updatedAt: Date.now(),
    };
    storageService.savePlaybackProgress(prog);
    onProgressUpdate?.(prog);
  };

  // Monitora zona de encerramento do episódio para contagem regressiva automática (com precisão exata de relógio de hardware)
  useEffect(() => {
    if (!channel || !nextEpisode || duration <= 60) {
      if (autoNextEpisodeTimerRef.current) {
        clearInterval(autoNextEpisodeTimerRef.current);
        autoNextEpisodeTimerRef.current = null;
      }
      countdownTargetTimeRef.current = null;
      setAutoNextCountdown(null);
      return;
    }

    const inCompletionZone = isVodCompleted(currentTime, duration);
    if (inCompletionZone && !isNavigatingNextEpRef.current) {
      if (!countdownTargetTimeRef.current) {
        // Fixa o timestamp de término exatamente 8 segundos no futuro usando o relógio real do SO
        countdownTargetTimeRef.current = Date.now() + 8000;
        setAutoNextCountdown(8);

        if (autoNextEpisodeTimerRef.current) {
          clearInterval(autoNextEpisodeTimerRef.current);
        }

        // Ticker leve a cada 200ms calculando a diferença real em ms (imune a throttling de timers em TVs)
        autoNextEpisodeTimerRef.current = window.setInterval(() => {
          if (!countdownTargetTimeRef.current) return;
          const diffMs = countdownTargetTimeRef.current - Date.now();
          if (diffMs <= 0) {
            if (autoNextEpisodeTimerRef.current) {
              clearInterval(autoNextEpisodeTimerRef.current);
              autoNextEpisodeTimerRef.current = null;
            }
            countdownTargetTimeRef.current = null;
            setAutoNextCountdown(null);
            handleTriggerNextEpisode();
          } else {
            const sec = Math.ceil(diffMs / 1000);
            setAutoNextCountdown(sec);
          }
        }, 200);
      }
    } else if (!inCompletionZone && countdownTargetTimeRef.current !== null) {
      // Se o usuário retrocedeu o vídeo antes da margem de créditos, cancela a contagem imediatamente
      if (autoNextEpisodeTimerRef.current) {
        clearInterval(autoNextEpisodeTimerRef.current);
        autoNextEpisodeTimerRef.current = null;
      }
      countdownTargetTimeRef.current = null;
      setAutoNextCountdown(null);
    }
  }, [currentTime, duration, channel, nextEpisode, handleTriggerNextEpisode]);

  useEffect(() => {
    return () => {
      if (autoNextEpisodeTimerRef.current) {
        clearInterval(autoNextEpisodeTimerRef.current);
        autoNextEpisodeTimerRef.current = null;
      }
    };
  }, []);

  const triggerOsd = useCallback((durationMs: number = 4500) => {
    setShowOsd(true);
    if (osdTimerRef.current) {
      window.clearTimeout(osdTimerRef.current);
    }
    osdTimerRef.current = window.setTimeout(() => {
      setShowOsd(false);
    }, durationMs);
  }, []);

  useEffect(() => {
    triggerOsd();
    if (usingHardwareAVPlay) {
      tizenAVPlay.updateDisplayArea(isFullScreen);
    }
    return () => {
      if (osdTimerRef.current) window.clearTimeout(osdTimerRef.current);
    };
  }, [channel?.url, isFullScreen, usingHardwareAVPlay]);

  useEffect(() => {
    const video = videoRef.current;
    setErrorMsg(null);
    setCurrentTime(0);
    setDuration(0);
    setResolutionLabel('');
    setUsingHardwareAVPlay(false);

    const cleanupWebPlayers = () => {
      flushProgressOnExit();
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
      if (mpegtsRef.current) {
        try {
          mpegtsRef.current.unload();
          mpegtsRef.current.detachMediaElement();
          mpegtsRef.current.destroy();
        } catch {}
        mpegtsRef.current = null;
      }
      if (video) {
        video.removeAttribute('src');
        try {
          video.load();
        } catch {}
      }
    };

    cleanupWebPlayers();
    tizenAVPlay.stop();

    if (!channel || !channel.url) {
      setIsBuffering(false);
      setIsPlaying(false);
      return;
    }

    const streamUrl = channel.url.trim();
    const streamType = classifyIptvUrl(streamUrl);
    setIsBuffering(true);

    const startHardwareAVPlay = (targetUrl: string): boolean => {
      if (!tizenAVPlay.isAvailable()) return false;
      cleanupWebPlayers();
      setUsingHardwareAVPlay(true);
      setActiveEngineName('Samsung AVPlay (Hardware)');
      return tizenAVPlay.play(targetUrl, isFullScreen, {
        onBufferingStart: () => setIsBuffering(true),
        onBufferingComplete: () => {
          setIsBuffering(false);
          setIsPlaying(true);
          setErrorMsg(null);
          const res = tizenAVPlay.getVideoResolutionLabel();
          if (res) setResolutionLabel(res);
          applyResumeIfEligible();
        },
        onTimeUpdate: (cur, dur) => {
          handleProgressTick(cur, dur);
        },
        onStreamCompleted: () => {
          handleTriggerNextEpisode();
        },
        onError: (err) => {
          const hlsVariant = tryConvertXtreamToHls(targetUrl);
          if (hlsVariant && hlsVariant !== targetUrl) {
            tizenAVPlay.play(hlsVariant, isFullScreen, {
              onBufferingStart: () => setIsBuffering(true),
              onBufferingComplete: () => {
                setIsBuffering(false);
                setIsPlaying(true);
                setErrorMsg(null);
                applyResumeIfEligible();
              },
              onTimeUpdate: (cur, dur) => {
                handleProgressTick(cur, dur);
              },
              onError: (err2) => {
                setIsBuffering(false);
                setErrorMsg(formatPlatformError('avplay', targetUrl, String(err2)));
              },
            });
            return;
          }
          setIsBuffering(false);
          setErrorMsg(formatPlatformError('avplay', targetUrl, String(err)));
        },
      });
    };

    const startHlsEngine = (targetUrl: string, allowFallbackToAVPlay: boolean): boolean => {
      if (!video || !Hls.isSupported()) return false;
      cleanupWebPlayers();
      setUsingHardwareAVPlay(false);
      setActiveEngineName('HLS.js Engine');

      const saved =
        savedProgressRef.current ||
        (channel?.url ? storageService.getPlaybackProgress(channel.url) : null);
      const targetStart =
        saved && !saved.completed && saved.currentTime >= 10 ? saved.currentTime : -1;

      const hls = new Hls({
        startPosition: targetStart,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
        manifestLoadingTimeOut: 12000,
        levelLoadingTimeOut: 12000,
      });

      hlsRef.current = hls;
      hls.loadSource(targetUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsBuffering(false);
        setErrorMsg(null);
        if (data.levels && data.levels.length > 0) {
          const highest = data.levels[data.levels.length - 1];
          if (highest.height) setResolutionLabel(`${highest.height}p`);
        }
        if (targetStart > 0) {
          hasAttemptedResumeRef.current = true;
          setResumeToast({
            time: targetStart,
            formatted: formatTime(targetStart),
          });
          if (resumeToastTimerRef.current) {
            window.clearTimeout(resumeToastTimerRef.current);
          }
          resumeToastTimerRef.current = window.setTimeout(() => {
            setResumeToast(null);
          }, 6000);
        }
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const level = hls.levels[data.level];
        if (level?.height) setResolutionLabel(`${level.height}p`);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
            return;
          }
          hls.destroy();
          hlsRef.current = null;
          if (allowFallbackToAVPlay && startHardwareAVPlay(streamUrl)) {
            return;
          }
          if (video) {
            setActiveEngineName(isWebOSTV() ? 'LG webOS Native Player' : 'HTML5 Direct Video');
            video.src = targetUrl;
            video.load();
            video.play().catch(() => {
              setIsBuffering(false);
              setErrorMsg(formatPlatformError('hls', targetUrl, data.details));
            });
            return;
          }
          setIsBuffering(false);
          setErrorMsg(formatPlatformError('hls', targetUrl, data.details));
        }
      });

      return true;
    };

    const startMpegTsEngine = (targetUrl: string): boolean => {
      if (!video || !mpegts.isSupported()) return false;
      cleanupWebPlayers();
      setUsingHardwareAVPlay(false);
      setActiveEngineName('MPEG-TS Live Engine');

      try {
        const player = mpegts.createPlayer(
          {
            type: 'mse',
            isLive: true,
            url: targetUrl,
            cors: true,
          },
          {
            enableWorker: true,
            enableStashBuffer: false,
            stashInitialSize: 128,
          }
        );

        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();
        const playPromise = player.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }

        player.on(mpegts.Events.ERROR, (_event, errType, errDetail) => {
          if (tizenAVPlay.isAvailable() && startHardwareAVPlay(streamUrl)) {
            return;
          }
          const hlsUrl = tryConvertXtreamToHls(targetUrl);
          if (hlsUrl && startHlsEngine(hlsUrl, true)) {
            return;
          }
          // Na TV LG webOS, o elemento <video src="..."> nativo contorna restrições de CORS do JavaScript
          if (video) {
            cleanupWebPlayers();
            setActiveEngineName(isWebOSTV() ? 'LG webOS Native Player' : 'HTML5 Direct Video');
            video.src = targetUrl;
            video.load();
            video.play().catch((playErr) => {
              setIsBuffering(false);
              setErrorMsg(
                formatPlatformError(
                  'mpegts',
                  targetUrl,
                  `${errType || ''}: ${errDetail || ''} / ${playErr?.message || ''}`
                )
              );
            });
            return;
          }
          setIsBuffering(false);
          setErrorMsg(
            formatPlatformError('mpegts', targetUrl, `${errType || ''}: ${errDetail || ''}`)
          );
        });

        return true;
      } catch {
        return false;
      }
    };

    if (
      tizenAVPlay.isAvailable() &&
      (engineMode === 'tizen_avplay' ||
        (engineMode === 'auto' &&
          (streamType === 'mpegts' ||
            streamType === 'vod_container' ||
            /\.mkv($|\?)/i.test(streamUrl))))
    ) {
      if (startHardwareAVPlay(streamUrl)) return;
    }

    if (streamType === 'hls') {
      if (startHlsEngine(streamUrl, true)) return;
    }

    if (streamType === 'mpegts') {
      if (startMpegTsEngine(streamUrl)) return;
      const hlsAlt = tryConvertXtreamToHls(streamUrl);
      if (hlsAlt && startHlsEngine(hlsAlt, true)) return;
    }

    if (video) {
      setActiveEngineName(isWebOSTV() ? 'LG webOS Native Player' : 'HTML5 Direct Video');
      video.src = streamUrl;
      video.load();
      video.play().catch((playErr) => {
        if (tizenAVPlay.isAvailable() && startHardwareAVPlay(streamUrl)) return;
        const hlsAlt = tryConvertXtreamToHls(streamUrl);
        if (hlsAlt && startHlsEngine(hlsAlt, true)) return;
        setIsBuffering(false);
        setErrorMsg(formatPlatformError('direct_codec', streamUrl, playErr?.message));
      });
    }

    return () => {
      flushProgressOnExit();
      cleanupWebPlayers();
      tizenAVPlay.stop();
    };
  }, [channel?.url, engineMode, retryCount]);

  const handleTogglePlayPause = () => {
    triggerOsd();
    if (usingHardwareAVPlay) {
      const playing = tizenAVPlay.togglePause();
      setIsPlaying(playing);
      if (!playing) flushProgressOnExit();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
      flushProgressOnExit();
    }
  };

  const handleToggleMute = () => {
    triggerOsd();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (newVol: number) => {
    triggerOsd();
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    video.volume = clamped;
    setVolume(clamped);
    if (clamped > 0 && video.muted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const handleSeek = (sec: number, isDirectClick = false) => {
    triggerOsd(4500);
    const maxSec = duration > 0 ? Math.max(0, duration - 2) : 86400;
    const clamped = Math.max(0, Math.min(maxSec, sec));
    
    // Atualização instantânea na interface (0ms de latência visual)
    const delta = clamped - currentTime;
    setScrubPreview({ time: clamped, delta });
    setCurrentTime(clamped);
    pendingSeekTargetRef.current = clamped;
    seekLockUntilRef.current = Date.now() + 1400;

    if (seekDebounceTimerRef.current) {
      window.clearTimeout(seekDebounceTimerRef.current);
    }

    // Debounce calibrado: 80ms para clique direto, 200ms para setas/D-Pad
    seekDebounceTimerRef.current = window.setTimeout(() => {
      if (usingHardwareAVPlay) {
        tizenAVPlay.seekTo(clamped);
      } else {
        const video = videoRef.current;
        if (video && Number.isFinite(video.duration) && video.duration > 0) {
          try {
            video.currentTime = clamped;
          } catch {}
        }
      }

      if (scrubTimeoutRef.current) {
        window.clearTimeout(scrubTimeoutRef.current);
      }
      scrubTimeoutRef.current = window.setTimeout(() => {
        setScrubPreview(null);
        pendingSeekTargetRef.current = null;
      }, 450);
    }, isDirectClick ? 80 : 200);
  };

  const stepSeek = (delta: number) => {
    const now = Date.now();
    if (now - lastSeekTimestampRef.current < 650) {
      consecutiveSeekCountRef.current = Math.min(5, consecutiveSeekCountRef.current + 1);
    } else {
      consecutiveSeekCountRef.current = 1;
    }
    lastSeekTimestampRef.current = now;

    // Aceleração progressiva no controle remoto estilo Netflix (10s -> 15s -> 20s -> 30s)
    const multiplier =
      consecutiveSeekCountRef.current >= 4 ? 3 : consecutiveSeekCountRef.current >= 2 ? 1.5 : 1;
    const effectiveDelta = Math.round(delta * multiplier);

    const base =
      scrubPreview !== null
        ? scrubPreview.time
        : pendingSeekTargetRef.current !== null
        ? pendingSeekTargetRef.current
        : currentTime;
    handleSeek(base + effectiveDelta);
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!duration || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetSec = Math.floor(ratio * duration);
    handleSeek(targetSec, true);
  };

  const startContinuousSeek = (delta: number) => {
    stepSeek(delta);
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }
    holdIntervalRef.current = window.setInterval(() => {
      stepSeek(delta);
    }, 220);
  };

  const stopContinuousSeek = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    consecutiveSeekCountRef.current = 0;
  };

  useEffect(() => {
    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        stopContinuousSeek();
      }
    };
    window.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      window.removeEventListener('keyup', handleGlobalKeyUp);
      stopContinuousSeek();
      if (seekDebounceTimerRef.current) window.clearTimeout(seekDebounceTimerRef.current);
      if (scrubTimeoutRef.current) window.clearTimeout(scrubTimeoutRef.current);
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      togglePlayPause: handleTogglePlayPause,
      seekDelta: (delta: number) => {
        stepSeek(delta);
        triggerOsd(4000);
      },
      showOsd: () => triggerOsd(6000),
      hideOsd: () => {
        setShowOsd(false);
        if (osdTimerRef.current) window.clearTimeout(osdTimerRef.current);
      },
      isOsdVisible: () => showOsd,
      isVod: () => Boolean(Number.isFinite(duration) && duration > 60 && duration < 86400),
      handleDpadNavigation: (key: string): boolean => {
        const isVod = Number.isFinite(duration) && duration > 60 && duration < 86400;
        const controlKeys = isVod
          ? (['restart', 'prev_step', 'rewind', 'play_pause', 'forward', 'next_step', 'favorite', 'exit_fullscreen'] as const)
          : (['prev_channel', 'play_pause', 'next_channel', 'favorite', 'exit_fullscreen'] as const);

        // Se o card de próximo episódio está visível e o OSD fechado, 1x OK aciona o próximo episódio
        const isCompletedZone = isVodCompleted(currentTime, duration);
        if (!showOsd && nextEpisode && isCompletedZone && key === 'Enter') {
          handleTriggerNextEpisode();
          return true;
        }

        // Se o OSD está oculto (assistindo limpo em tela cheia)
        if (!showOsd) {
          if (key === 'Enter') {
            // 1x OK: Pausa/despausa e abre a barra com o foco em Play/Pause!
            handleTogglePlayPause();
            setControlFocusIndex(isVod ? 3 : 1);
            triggerOsd(5000);
            return true;
          }
          if (key === 'ArrowDown') {
            // Seta para baixo: abre a barra de controles e foca no Play/Pause!
            setControlFocusIndex(isVod ? 3 : 1);
            triggerOsd(6000);
            return true;
          }
          if (key === 'ArrowUp') {
            // Seta para cima: mostra as informações do canal / OSD superior
            triggerOsd(5000);
            return true;
          }
          if (key === 'ArrowRight') {
            if (isVod) {
              stepSeek(10);
              triggerOsd(4000);
              return true;
            }
            return false;
          }
          if (key === 'ArrowLeft') {
            if (isVod) {
              stepSeek(-10);
              triggerOsd(4000);
              return true;
            }
            return false;
          }
          return false;
        }

        // Se o OSD já está visível:
        triggerOsd(6000);

        if (key === 'ArrowLeft') {
          setControlFocusIndex((prev) => (prev > 0 ? prev - 1 : controlKeys.length - 1));
          return true;
        }

        if (key === 'ArrowRight') {
          setControlFocusIndex((prev) => (prev < controlKeys.length - 1 ? prev + 1 : 0));
          return true;
        }

        if (key === 'ArrowUp') {
          setShowOsd(false);
          if (osdTimerRef.current) window.clearTimeout(osdTimerRef.current);
          return true;
        }

        if (key === 'Enter') {
          const selectedBtn = controlKeys[controlFocusIndex] || (isVod ? controlKeys[3] : controlKeys[1]);
          if (selectedBtn === 'play_pause') {
            handleTogglePlayPause();
          } else if (selectedBtn === 'restart') {
            handleSeek(0, true);
          } else if (selectedBtn === 'prev_step') {
            onChannelStep(-1);
          } else if (selectedBtn === 'rewind') {
            stepSeek(-10);
          } else if (selectedBtn === 'forward') {
            stepSeek(10);
          } else if (selectedBtn === 'next_step') {
            if (nextEpisode) {
              handleTriggerNextEpisode();
            } else {
              onChannelStep(1);
            }
          } else if (selectedBtn === 'prev_channel') {
            onChannelStep(-1);
          } else if (selectedBtn === 'next_channel') {
            onChannelStep(1);
          } else if (selectedBtn === 'favorite') {
            onToggleFavorite();
          } else if (selectedBtn === 'exit_fullscreen') {
            onToggleFullScreen();
          }
          return true;
        }

        return false;
      },
    }),
    [
      handleTogglePlayPause,
      handleSeek,
      stepSeek,
      currentTime,
      duration,
      showOsd,
      controlFocusIndex,
      onChannelStep,
      onToggleFavorite,
      onToggleFullScreen,
      triggerOsd,
    ]
  );

  const isVodSeekable = Number.isFinite(duration) && duration > 60 && duration < 86400;
  const qrTargetUrl = `${lanBaseUrl}/?pair=${encodeURIComponent(pairingCode)}`;

  return (
    <div
      className={`video-stage ${usingHardwareAVPlay ? 'avplay-stage-transparent' : ''}`}
      onMouseMove={() => triggerOsd()}
      onClick={() => triggerOsd()}
      onDoubleClick={onToggleFullScreen}
    >
      <video
        ref={videoRef}
        className="html5-video-element"
        style={{ display: usingHardwareAVPlay ? 'none' : 'block' }}
        playsInline
        autoPlay
        onLoadedMetadata={() => {
          if (videoRef.current?.duration) {
            setDuration(videoRef.current.duration);
          }
          applyResumeIfEligible(videoRef.current?.duration);
        }}
        onCanPlay={() => {
          applyResumeIfEligible(videoRef.current?.duration);
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
          setErrorMsg(null);
          if (videoRef.current?.videoHeight) {
            setResolutionLabel(`${videoRef.current.videoHeight}p`);
          }
          applyResumeIfEligible(videoRef.current?.duration);
        }}
        onPause={() => {
          setIsPlaying(false);
          flushProgressOnExit();
        }}
        onEnded={() => {
          handleTriggerNextEpisode();
        }}
        onTimeUpdate={() => {
          if (videoRef.current) {
            handleProgressTick(videoRef.current.currentTime, videoRef.current.duration || 0);
          }
        }}
        onError={() => {
          if (!hlsRef.current && !mpegtsRef.current && channel?.url) {
            if (tizenAVPlay.isAvailable() && !usingHardwareAVPlay) {
              setUsingHardwareAVPlay(true);
              setActiveEngineName('Samsung AVPlay (Auto-Fallback)');
              tizenAVPlay.play(channel.url, isFullScreen, {
                onBufferingStart: () => setIsBuffering(true),
                onBufferingComplete: () => {
                  setIsBuffering(false);
                  setIsPlaying(true);
                  setErrorMsg(null);
                },
                onError: (err) => {
                  setIsBuffering(false);
                  setErrorMsg(formatPlatformError('avplay', channel.url, String(err)));
                },
              });
              return;
            }
            setIsBuffering(false);
            setErrorMsg(formatPlatformError('html5_error', channel.url));
          }
        }}
      />

      {resumeToast && (
        <div className="resume-playback-toast">
          <div className="resume-toast-info">
            <RotateCcw size={16} className="resume-toast-icon" />
            <span>
              Retomando de <strong>{resumeToast.formatted}</strong>
            </span>
          </div>
          <button
            type="button"
            className="resume-toast-restart-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleSeek(0);
              setResumeToast(null);
            }}
          >
            Recomeçar do Início
          </button>
        </div>
      )}

      {/* Card Flutuante de Próximo Episódio (Estilo Streaming / Netflix) */}
      {channel && nextEpisode && isVodCompleted(currentTime, duration) && (
        <div className="next-episode-floating-prompt">
          <div className="next-ep-header">
            <span className="next-ep-badge">
              {autoNextCountdown !== null
                ? `PRÓXIMO EPISÓDIO EM ${autoNextCountdown}S`
                : 'PRÓXIMO EPISÓDIO'}
            </span>
            <span className="next-ep-tag">
              S{String(nextEpisode.seasonNumber || 1).padStart(2, '0')}E{String(nextEpisode.episodeNumber || 1).padStart(2, '0')}
            </span>
          </div>
          <div className="next-ep-title">{nextEpisode.name}</div>
          <button
            type="button"
            className="tv-btn primary next-ep-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleTriggerNextEpisode();
            }}
          >
            <SkipForward size={18} fill="currentColor" />
            <span>
              {autoNextCountdown !== null
                ? `Reproduzindo em ${autoNextCountdown}s (ou OK)`
                : 'Assistir Próximo Episódio'}
            </span>
            <span className="dpad-ok-pill">OK ➔</span>
          </button>
        </div>
      )}

      {numericBuffer && (
        <div className="numeric-zapping-osd">
          <span className="numeric-label">CANAL</span>
          <span className="numeric-digits">{numericBuffer}</span>
        </div>
      )}

      {/* PAINEL DE BOAS-VINDAS / ONBOARDING QUANDO NENHUM CANAL FOI ESCOLHIDO AINDA */}
      {!channel && (
        <div className="player-empty-state">
          {totalChannelsCount === 0 ? (
            /* Caso 1: Nenhuma lista M3U salva ainda -> Exibe QR Code direto na tela principal! */
            <div className="onboarding-hero-card">
              <div className="onboarding-left">
                <div className="onboarding-brand-row">
                  <img src="./tv_banner.png" alt="TVPlayer" className="onboarding-logo" />
                  <div>
                    <span className="welcome-tag">BEM-VINDO AO TVPLAYER SMART TV</span>
                    <h2>Configure sua lista IPTV em segundos</h2>
                  </div>
                </div>
                <p className="onboarding-desc">
                  Aponte a câmera do seu celular para o <strong>QR Code ao lado</strong> para abrir{' '}
                  <code>admjorgeluiz.github.io/tv</code> e colar sua lista <code>.M3U</code> ou
                  login <strong>Xtream Codes</strong> sem precisar digitar no controle remoto!
                </p>
                <div className="qr-url-highlight" style={{ marginTop: 4 }}>
                  <Smartphone size={16} />
                  <span>{qrTargetUrl}</span>
                </div>
                <div className="onboarding-actions">
                  <button type="button" className="tv-btn primary" onClick={onOpenSettingsModal}>
                    <QrCode size={18} /> Abrir Painel de Configuração (Botão Azul)
                  </button>
                  <button type="button" className="tv-btn secondary" onClick={onLoadDemoChannels}>
                    <Sparkles size={18} /> Carregar Canais de Demonstração
                  </button>
                </div>
              </div>

              <div className="onboarding-right-qr">
                <div className="qr-white-frame">
                  <QRCodeSVG
                    value={qrTargetUrl}
                    size={175}
                    level="M"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#0b0f17"
                  />
                </div>
                <span className="qr-code-badge">CÓDIGO: {pairingCode}</span>
              </div>
            </div>
          ) : (
            /* Caso 2: Lista já está carregada e pronta, aguardando o usuário escolher um canal */
            <div className="ready-dashboard-card">
              <img src="./tv_banner.png" alt="TVPlayer" className="onboarding-logo" />
              <span className="welcome-tag">LISTA PRONTA NA MEMÓRIA DA TV</span>
              <h2>
                {totalChannelsCount.toLocaleString('pt-BR')} canais em {totalGroupsCount} categorias
              </h2>
              <p>
                Use as <strong>Setas ▲ ▼</strong> na lista à esquerda (ou aperte{' '}
                <strong>► Direita</strong> para retomar o último canal) e pressione{' '}
                <strong>OK</strong>.
              </p>

              {lastWatchedChannel && !lastWatchedChannel.isAdult && onSelectLastChannel && (() => {
                const prog =
                  lastWatchedChannel.playbackProgress ||
                  storageService.getPlaybackProgress(lastWatchedChannel.url);
                const hasTime = Boolean(
                  prog && prog.currentTime > 0 && !lastWatchedChannel.isNextEpisodeSuggestion
                );
                const curFormatted = hasTime ? formatTime(prog!.currentTime) : '';
                const durFormatted = hasTime && prog!.duration > 0 ? formatTime(prog!.duration) : '';
                const remainingSec =
                  hasTime && prog!.duration > prog!.currentTime ? prog!.duration - prog!.currentTime : 0;
                const remFormatted = remainingSec > 0 ? formatTime(remainingSec) : '';

                return (
                  <div className="resume-hero-card">
                    <div className="resume-hero-header">
                      <span className="resume-pill-badge">
                        {lastWatchedChannel.isNextEpisodeSuggestion
                          ? 'A Seguir'
                          : 'Continuar Assistindo'}
                      </span>
                      {hasTime && prog!.percentage > 0 && (
                        <span className="resume-pct-pill">{prog!.percentage}% concluído</span>
                      )}
                    </div>

                    <div className="resume-hero-title-wrap">
                      <span className="resume-channel-name">{lastWatchedChannel.name}</span>
                      {lastWatchedChannel.seriesName && (
                        <span className="resume-series-tag">
                          {lastWatchedChannel.seriesName} • Temp.{' '}
                          {lastWatchedChannel.seasonNumber || 1} Ep.{' '}
                          {lastWatchedChannel.episodeNumber || 1}
                        </span>
                      )}
                    </div>

                    {hasTime && prog!.duration > 0 && (
                      <div className="resume-progress-container">
                        <div className="resume-progress-track">
                          <div
                            className="resume-progress-fill"
                            style={{
                              width: `${Math.min(100, Math.max(3, prog!.percentage))}%`,
                            }}
                          />
                        </div>
                        <div className="resume-time-labels">
                          <span>
                            Parou em <strong>{curFormatted}</strong>
                            {durFormatted ? ` / ${durFormatted}` : ''}
                          </span>
                          {remFormatted && <span>Resta <strong>{remFormatted}</strong></span>}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      className={`tv-btn primary resume-last-btn ${
                        isStageFocused ? 'dpad-focused' : ''
                      }`}
                      onClick={() => onSelectLastChannel(lastWatchedChannel)}
                    >
                      <Play size={18} fill="currentColor" />
                      <span>
                        {lastWatchedChannel.isNextEpisodeSuggestion
                          ? 'Assistir Próximo Episódio'
                          : hasTime
                          ? `Continuar de ${curFormatted}`
                          : `Assistir: ${lastWatchedChannel.name}`}
                      </span>
                      {isStageFocused && (
                        <span className="dpad-ok-pill" style={{ marginLeft: 8 }}>
                          OK ➔ Tela Cheia
                        </span>
                      )}
                    </button>
                  </div>
                );
              })()}

              <div className="tv-guide-grid">
                <div className="guide-step-box">
                  <strong>1. Escolher Categoria</strong>
                  <span>Setas ▲ ▼ + OK para abrir</span>
                </div>
                <div className="guide-step-box">
                  <strong>2. Sintonizar Canal</strong>
                  <span>1x OK abre no Player • 2x OK abre Tela Cheia</span>
                </div>
                <div className="guide-step-box">
                  <strong>3. Troca Rápida</strong>
                  <span>Em Tela Cheia, ▲ ▼ ou CH+/CH- muda de canal</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Spinner de Buffering */}
      {channel && isBuffering && !errorMsg && (
        <div className="player-buffering-overlay">
          <div className="tv-spinner" />
          <span>Sintonizando {channel.name}...</span>
        </div>
      )}

      {/* Overlay de Erro com Botão de Reconexão / Troca de Motor */}
      {channel && errorMsg && (
        <div className="player-error-overlay">
          <AlertTriangle size={44} className="error-icon" />
          <div className="error-platform-badge">{getPlatformDisplayName()}</div>
          <h3>Não foi possível reproduzir este canal</h3>
          <p>{errorMsg}</p>
          <div className="error-actions">
            <button
              type="button"
              className="tv-btn primary"
              onClick={() => setRetryCount((c) => c + 1)}
            >
              <RotateCcw size={18} /> Tentar Novamente
            </button>
            <button type="button" className="tv-btn secondary" onClick={onSwitchEngine}>
              <Cpu size={18} /> Alternar Motor ({engineMode.toUpperCase()})
            </button>
          </div>
        </div>
      )}

      {/* OSD Superior + Inferior Estilo Receptor Smart TV */}
      {channel && (
        <div className={`tv-osd-container ${showOsd ? 'visible' : 'hidden'}`}>
          <div className="tv-osd-top">
            <div className="osd-channel-card">
              <div className="osd-channel-number">#{String(channel.number).padStart(3, '0')}</div>
              {channel.logo ? (
                <img
                  src={channel.logo}
                  alt={channel.name}
                  className="osd-channel-logo"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="osd-channel-logo-fallback">
                  <Tv size={24} />
                </div>
              )}
              <div className="osd-channel-meta">
                <div className="osd-channel-title-row">
                  <h2>{channel.name}</h2>
                  {isFavorite && <Star size={20} className="fav-star-active" fill="#f4e154" />}
                </div>
                <span className="osd-channel-group">{channel.group}</span>
              </div>
            </div>

            <div className="osd-badges">
              {isVodSeekable || classifyIptvUrl(channel.url) === 'vod_container' ? (
                <span className="osd-badge vod">🎬 {channel.seriesName ? 'SÉRIE' : 'VOD'}</span>
              ) : (
                <span className="osd-badge live">● AO VIVO</span>
              )}
              {resolutionLabel ? <span className="osd-badge res">{resolutionLabel}</span> : null}
              <span className="osd-badge engine">{activeEngineName}</span>
            </div>
          </div>

          <div className="tv-osd-bottom netflix-osd-bottom">
            {isVodSeekable && (
              <div className="netflix-timeline-wrapper">
                <div className="netflix-timeline-labels">
                  <span className="netflix-time-current">
                    {formatTime(scrubPreview ? scrubPreview.time : currentTime)}
                  </span>
                  <span className="netflix-time-remaining">
                    {duration > (scrubPreview ? scrubPreview.time : currentTime)
                      ? `-${formatTime(duration - (scrubPreview ? scrubPreview.time : currentTime))}`
                      : formatTime(duration)}
                  </span>
                </div>
                <div
                  ref={timelineTrackRef}
                  className={`netflix-timeline-track ${scrubPreview ? 'is-scrubbing' : 'is-gliding'}`}
                  onClick={handleTimelineClick}
                >
                  <div className="netflix-timeline-rail" />
                  <div
                    className="netflix-timeline-fill"
                    style={{
                      width: `${
                        duration > 0
                          ? Math.min(
                              100,
                              Math.max(
                                0,
                                ((scrubPreview ? scrubPreview.time : currentTime) / duration) * 100
                              )
                            )
                          : 0
                      }%`,
                    }}
                  />
                  <div
                    className="netflix-timeline-thumb"
                    style={{
                      left: `${
                        duration > 0
                          ? Math.min(
                              100,
                              Math.max(
                                0,
                                ((scrubPreview ? scrubPreview.time : currentTime) / duration) * 100
                              )
                            )
                          : 0
                      }%`,
                    }}
                  />
                  {scrubPreview && (
                    <div
                      className="netflix-scrub-bubble"
                      style={{
                        left: `${
                          duration > 0
                            ? Math.min(94, Math.max(6, (scrubPreview.time / duration) * 100))
                            : 0
                        }%`,
                      }}
                    >
                      <span className="bubble-time">{formatTime(scrubPreview.time)}</span>
                      {scrubPreview.delta !== 0 && (
                        <span className="bubble-delta">
                          {scrubPreview.delta > 0
                            ? `+${Math.round(scrubPreview.delta)}s`
                            : `${Math.round(scrubPreview.delta)}s`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="osd-controls-bar">
              <div className="osd-controls-left">
                {isVodSeekable ? (
                  <>
                    <button
                      type="button"
                      className={`osd-ctrl-btn ${
                        isFullScreen && controlFocusIndex === 0 ? 'dpad-focused' : ''
                      }`}
                      onClick={() => handleSeek(0, true)}
                      title="Voltar para o início (00:00)"
                    >
                      <RotateCcw size={16} />
                      <span>Início</span>
                    </button>

                    <button
                      type="button"
                      className={`osd-ctrl-btn ${
                        isFullScreen && controlFocusIndex === 1 ? 'dpad-focused' : ''
                      }`}
                      onClick={() => onChannelStep(-1)}
                      title={channel?.seriesName ? 'Episódio Anterior' : 'Canal Anterior'}
                    >
                      <SkipBack size={16} />
                      <span>{channel?.seriesName ? 'Ep -' : 'CH -'}</span>
                    </button>

                    <button
                      type="button"
                      className={`osd-ctrl-btn ${
                        isFullScreen && controlFocusIndex === 2 ? 'dpad-focused' : ''
                      }`}
                      onClick={() => stepSeek(-10)}
                      onMouseDown={() => startContinuousSeek(-10)}
                      onMouseUp={stopContinuousSeek}
                      onMouseLeave={stopContinuousSeek}
                      title="Voltar 10s (◄)"
                    >
                      <span>-10s</span>
                    </button>

                    <button
                      type="button"
                      className={`osd-ctrl-btn play-pause-main ${
                        isFullScreen && controlFocusIndex === 3 ? 'dpad-focused' : ''
                      }`}
                      onClick={handleTogglePlayPause}
                      title="Play / Pause (OK)"
                    >
                      {isPlaying ? (
                        <Pause size={22} fill="currentColor" />
                      ) : (
                        <Play size={22} fill="currentColor" />
                      )}
                    </button>

                    <button
                      type="button"
                      className={`osd-ctrl-btn ${
                        isFullScreen && controlFocusIndex === 4 ? 'dpad-focused' : ''
                      }`}
                      onClick={() => stepSeek(10)}
                      onMouseDown={() => startContinuousSeek(10)}
                      onMouseUp={stopContinuousSeek}
                      onMouseLeave={stopContinuousSeek}
                      title="Avançar 10s (►)"
                    >
                      <span>+10s</span>
                    </button>

                    <button
                      type="button"
                      className={`osd-ctrl-btn ${
                        isFullScreen && controlFocusIndex === 5 ? 'dpad-focused' : ''
                      }`}
                      onClick={() => {
                        if (nextEpisode) {
                          handleTriggerNextEpisode();
                        } else {
                          onChannelStep(1);
                        }
                      }}
                      title={channel?.seriesName ? 'Próximo Episódio' : 'Próximo Canal'}
                    >
                      <SkipForward size={16} />
                      <span>{channel?.seriesName ? 'Ep +' : 'CH +'}</span>
                    </button>

                    <button
                      type="button"
                      className={`osd-ctrl-btn ${isFavorite ? 'active-fav' : ''} ${
                        isFullScreen && controlFocusIndex === 6 ? 'dpad-focused' : ''
                      }`}
                      onClick={onToggleFavorite}
                      title="Favoritar Canal / Série"
                    >
                      <Star size={16} fill={isFavorite ? '#f4e154' : 'none'} />
                      <span>{isFavorite ? 'Favorito' : 'Favoritar'}</span>
                    </button>

                    <button
                      type="button"
                      className={`osd-ctrl-btn primary-purple ${
                        isFullScreen && controlFocusIndex === 7 ? 'dpad-focused' : ''
                      }`}
                      onClick={onToggleFullScreen}
                      title="Lista de Canais (Voltar)"
                    >
                      <Minimize2 size={16} />
                      <span>Lista</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`osd-ctrl-btn ${
                        isFullScreen && controlFocusIndex === 0 ? 'dpad-focused' : ''
                      }`}
                      onClick={() => onChannelStep(-1)}
                      title="Canal Anterior (CH-)"
                    >
                      <SkipBack size={16} />
                      <span>CH -</span>
                    </button>

                    <button
                      type="button"
                      className={`osd-ctrl-btn play-pause-main ${
                        isFullScreen && controlFocusIndex === 1 ? 'dpad-focused' : ''
                      }`}
                      onClick={handleTogglePlayPause}
                      title="Play / Pause (OK)"
                    >
                      {isPlaying ? (
                        <Pause size={22} fill="currentColor" />
                      ) : (
                        <Play size={22} fill="currentColor" />
                      )}
                    </button>

                    <button
                      type="button"
                      className={`osd-ctrl-btn ${
                        isFullScreen && controlFocusIndex === 2 ? 'dpad-focused' : ''
                      }`}
                      onClick={() => onChannelStep(1)}
                      title="Próximo Canal (CH+)"
                    >
                      <SkipForward size={16} />
                      <span>CH +</span>
                    </button>

                    <button
                      type="button"
                      className={`osd-ctrl-btn ${isFavorite ? 'active-fav' : ''} ${
                        isFullScreen && controlFocusIndex === 3 ? 'dpad-focused' : ''
                      }`}
                      onClick={onToggleFavorite}
                      title="Favoritar Canal (Botão Amarelo / F3)"
                    >
                      <Star size={16} fill={isFavorite ? '#f4e154' : 'none'} />
                      <span>{isFavorite ? 'Favorito' : 'Favoritar'}</span>
                    </button>

                    <button
                      type="button"
                      className={`osd-ctrl-btn primary-purple ${
                        isFullScreen && controlFocusIndex === 4 ? 'dpad-focused' : ''
                      }`}
                      onClick={onToggleFullScreen}
                      title="Lista de Canais (Voltar)"
                    >
                      <Minimize2 size={16} />
                      <span>Lista</span>
                    </button>
                  </>
                )}
              </div>

              <div className="osd-controls-right">
                <button
                  type="button"
                  className="osd-ctrl-btn icon-only"
                  onClick={handleToggleMute}
                  title="Mudo"
                >
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="tv-slider volume"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
