import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import { QRCodeSVG } from 'qrcode.react';
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Star,
  Tv,
  Volume2,
  VolumeX,
  AlertTriangle,
  Cpu,
  Smartphone,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { Channel, PlayerEngineMode } from '../types/iptv';
import { tizenAVPlay } from '../services/tizenBridge';
import { detectLanServerBaseUrl } from '../services/pairingService';

interface VideoPlayerProps {
  channel: Channel | null;
  totalChannelsCount: number;
  totalGroupsCount: number;
  pairingCode: string;
  lastWatchedChannel?: Channel | null;
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

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  totalChannelsCount,
  totalGroupsCount,
  pairingCode,
  lastWatchedChannel,
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
}) => {
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
  const [resolutionLabel, setResolutionLabel] = useState<string>('AUTO');
  const [activeEngineName, setActiveEngineName] = useState<string>('Auto Engine');
  const [usingHardwareAVPlay, setUsingHardwareAVPlay] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showOsd, setShowOsd] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [lanBaseUrl, setLanBaseUrl] = useState('https://admjorgeluiz.github.io/tv');

  useEffect(() => {
    detectLanServerBaseUrl().then((u) => setLanBaseUrl(u));
  }, []);

  const triggerOsd = () => {
    setShowOsd(true);
    if (osdTimerRef.current) {
      window.clearTimeout(osdTimerRef.current);
    }
    osdTimerRef.current = window.setTimeout(() => {
      setShowOsd(false);
    }, 4500);
  };

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
    setResolutionLabel('AO VIVO');
    setUsingHardwareAVPlay(false);

    const cleanupWebPlayers = () => {
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
        },
        onTimeUpdate: (cur, dur) => {
          setCurrentTime(cur);
          setDuration(dur);
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
              },
              onTimeUpdate: (cur, dur) => {
                setCurrentTime(cur);
                setDuration(dur);
              },
              onError: (err2) => {
                setIsBuffering(false);
                setErrorMsg(`Canal offline no servidor ou formato indisponível (${err2})`);
              },
            });
            return;
          }
          setIsBuffering(false);
          setErrorMsg(`Canal offline ou indisponível no servidor (${err})`);
        },
      });
    };

    const startHlsEngine = (targetUrl: string, allowFallbackToAVPlay: boolean): boolean => {
      if (!video || !Hls.isSupported()) return false;
      cleanupWebPlayers();
      setUsingHardwareAVPlay(false);
      setActiveEngineName('HLS.js Engine');

      const hls = new Hls({
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
          setIsBuffering(false);
          setErrorMsg('Canal indisponível ou bloqueado por CORS neste motor.');
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

        player.on(mpegts.Events.ERROR, () => {
          if (tizenAVPlay.isAvailable() && startHardwareAVPlay(streamUrl)) {
            return;
          }
          const hlsUrl = tryConvertXtreamToHls(targetUrl);
          if (hlsUrl && startHlsEngine(hlsUrl, true)) {
            return;
          }
          setIsBuffering(false);
          setErrorMsg(
            'Este canal usa MPEG-TS/Codec nativo sem CORS para navegador. Na TV Samsung ele usa o decodificador AVPlay!'
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
        (engineMode === 'auto' && (streamType === 'mpegts' || /\.mkv($|\?)/i.test(streamUrl))))
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
      setActiveEngineName('HTML5 Direct Video');
      video.src = streamUrl;
      video.load();
      video.play().catch(() => {
        if (tizenAVPlay.isAvailable() && startHardwareAVPlay(streamUrl)) return;
        const hlsAlt = tryConvertXtreamToHls(streamUrl);
        if (hlsAlt && startHlsEngine(hlsAlt, true)) return;
        setIsBuffering(false);
        setErrorMsg(
          'Codec de vídeo/áudio (ex: MKV/AC3/TS) não suportado pelo navegador HTML5. Na TV Samsung, use o motor AVPlay!'
        );
      });
    }

    return () => {
      cleanupWebPlayers();
      tizenAVPlay.stop();
    };
  }, [channel?.url, engineMode, retryCount]);

  const handleTogglePlayPause = () => {
    triggerOsd();
    if (usingHardwareAVPlay) {
      const playing = tizenAVPlay.togglePause();
      setIsPlaying(playing);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
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

  const handleSeek = (sec: number) => {
    triggerOsd();
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    video.currentTime = sec;
    setCurrentTime(sec);
  };

  const isVodSeekable = Number.isFinite(duration) && duration > 60 && duration < 86400;
  const qrTargetUrl = `${lanBaseUrl}/?pair=${encodeURIComponent(pairingCode)}`;

  return (
    <div
      className={`video-stage ${usingHardwareAVPlay ? 'avplay-stage-transparent' : ''}`}
      onMouseMove={triggerOsd}
      onClick={triggerOsd}
      onDoubleClick={onToggleFullScreen}
    >
      <video
        ref={videoRef}
        className="html5-video-element"
        style={{ display: usingHardwareAVPlay ? 'none' : 'block' }}
        playsInline
        autoPlay
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
          setErrorMsg(null);
          if (videoRef.current?.videoHeight) {
            setResolutionLabel(`${videoRef.current.videoHeight}p`);
          }
        }}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            setDuration(videoRef.current.duration || 0);
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
                  setErrorMsg(`Canal indisponível no servidor (${err})`);
                },
              });
              return;
            }
            setIsBuffering(false);
            setErrorMsg('Formato de stream não suportado no navegador ou canal offline.');
          }
        }}
      />

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

              {lastWatchedChannel && !lastWatchedChannel.isAdult && onSelectLastChannel && (
                <button
                  type="button"
                  className={`tv-btn primary resume-last-btn ${
                    isStageFocused ? 'dpad-focused' : ''
                  }`}
                  onClick={() => onSelectLastChannel(lastWatchedChannel)}
                >
                  <Play size={18} fill="currentColor" /> Continuar Assistindo:{' '}
                  {lastWatchedChannel.name}
                  {isStageFocused && (
                    <span className="dpad-ok-pill" style={{ marginLeft: 8 }}>
                      OK ➔
                    </span>
                  )}
                </button>
              )}

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
              <span className="osd-badge live">● AO VIVO</span>
              <span className="osd-badge res">{resolutionLabel}</span>
              <span className="osd-badge engine">{activeEngineName}</span>
            </div>
          </div>

          <div className="tv-osd-bottom">
            {isVodSeekable && (
              <div className="osd-timeline-row">
                <span className="time-label">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="tv-slider timeline"
                />
                <span className="time-label">{formatTime(duration)}</span>
              </div>
            )}

            <div className="osd-controls-bar">
              <div className="osd-controls-left">
                <button
                  type="button"
                  className="osd-ctrl-btn"
                  onClick={handleTogglePlayPause}
                  title="Play / Pause (Espaço)"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                  <span>{isPlaying ? 'Pausar' : 'Reproduzir'}</span>
                </button>

                <button
                  type="button"
                  className="osd-ctrl-btn"
                  onClick={() => onChannelStep(-1)}
                  title="Canal Anterior (CH- / Seta Baixo)"
                >
                  <span>▼ Canal Ant.</span>
                </button>

                <button
                  type="button"
                  className="osd-ctrl-btn"
                  onClick={() => onChannelStep(1)}
                  title="Próximo Canal (CH+ / Seta Cima)"
                >
                  <span>▲ Próx. Canal</span>
                </button>

                <button
                  type="button"
                  className={`osd-ctrl-btn ${isFavorite ? 'active-fav' : ''}`}
                  onClick={onToggleFavorite}
                  title="Favoritar Canal (Botão Amarelo / F3)"
                >
                  <Star size={18} fill={isFavorite ? '#f4e154' : 'none'} />
                  <span>{isFavorite ? 'Favorito' : 'Favoritar'}</span>
                </button>
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

                <button
                  type="button"
                  className="osd-ctrl-btn primary-purple"
                  onClick={onToggleFullScreen}
                  title="Alternar Tela Cheia (Botão Vermelho / OK)"
                >
                  {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  <span>{isFullScreen ? '◄ Voltar à Lista' : 'Tela Cheia'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
