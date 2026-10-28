import { XtreamCredentials } from '../types/iptv';
import { buildXtreamM3uUrl } from './m3uParser';

export interface PairedPlaylistPayload {
  type: 'm3u_url' | 'xtream' | 'm3u_content';
  m3uUrl?: string;
  serverUrl?: string;
  username?: string;
  password?: string;
  rawContent?: string;
  timestamp: number;
}

const PAIR_CODE_STORAGE_KEY = 'TVPlayer_PairingCode';
export const GITHUB_PAGES_TV_URL = 'https://admjorgeluiz.github.io/tv';
const DEFAULT_LAN_HOST = 'http://192.168.68.106:5173';

export function getOrCreatePairingCode(): string {
  try {
    const existing = localStorage.getItem(PAIR_CODE_STORAGE_KEY);
    if (existing && existing.length >= 4) return existing;
  } catch {
    // Ignorar
  }

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  try {
    localStorage.setItem(PAIR_CODE_STORAGE_KEY, code);
  } catch {
    // Ignorar
  }
  return code;
}

/**
 * Retorna a URL oficial publicada no GitHub Pages para o QR Code da TV
 * (Funciona de qualquer celular/4G/Wi-Fi mesmo com o PC desligado!)
 */
export async function detectLanServerBaseUrl(): Promise<string> {
  return GITHUB_PAGES_TV_URL;
}

/**
 * Envia a lista M3U / Xtream do Celular ou PC para a TV Samsung (via Relay HTTPS na Nuvem + Rede Local)
 */
export async function sendPlaylistToTV(
  pairCode: string,
  payload: Omit<PairedPlaylistPayload, 'timestamp'>,
  lanBaseUrl?: string
): Promise<void> {
  const cleanCode = pairCode.trim().toUpperCase();
  const fullPayload: PairedPlaylistPayload = {
    ...payload,
    timestamp: Date.now(),
  };

  if (
    fullPayload.type === 'xtream' &&
    fullPayload.serverUrl &&
    fullPayload.username &&
    fullPayload.password
  ) {
    fullPayload.m3uUrl = buildXtreamM3uUrl({
      serverUrl: fullPayload.serverUrl,
      username: fullPayload.username,
      password: fullPayload.password,
    });
  }

  let sentAny = false;

  // 1. Envia via Relay HTTPS na Nuvem (ntfy.sh) — funciona do GitHub Pages (https://admjorgeluiz.github.io/tv)
  try {
    if (fullPayload.type !== 'm3u_content' || (fullPayload.rawContent?.length || 0) < 3500) {
      const relayRes = await fetch(`https://ntfy.sh/tvplayer_samsung_${cleanCode}`, {
        method: 'POST',
        body: JSON.stringify(fullPayload),
      });
      if (relayRes.ok) sentAny = true;
    }
  } catch {
    // Ignorar falha externa
  }

  // 2. Fallback para servidor local caso esteja em ambiente de desenvolvimento
  try {
    const localTarget =
      lanBaseUrl && lanBaseUrl.startsWith('http://192.') ? lanBaseUrl : DEFAULT_LAN_HOST;
    const res = await fetch(`${localTarget}/api/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: cleanCode,
        ...fullPayload,
      }),
    });
    if (res.ok) sentAny = true;
  } catch {
    // Ignorar se o PC estiver desligado
  }

  if (!sentAny) {
    throw new Error('Não foi possível enviar a lista para a TV. Verifique sua conexão.');
  }
}

/**
 * Escuta na TV Samsung pela chegada de uma nova lista enviada pelo GitHub Pages (https://admjorgeluiz.github.io/tv)
 */
export function subscribeToPairingCode(
  pairCode: string,
  onReceive: (payload: PairedPlaylistPayload, creds?: XtreamCredentials) => void
): () => void {
  const cleanCode = pairCode.trim().toUpperCase();
  const topic = `tvplayer_samsung_${cleanCode}`;
  let stopped = false;
  const seenMessageIds = new Set<string>();
  let initializedCacheIds = false;

  const handleIncoming = (msgId: string, data: PairedPlaylistPayload) => {
    if (!data || stopped) return;
    if (msgId && seenMessageIds.has(msgId)) return;
    if (msgId) seenMessageIds.add(msgId);

    let creds: XtreamCredentials | undefined;
    if (data.serverUrl && data.username && data.password) {
      creds = {
        serverUrl: data.serverUrl,
        username: data.username,
        password: data.password,
      };
    }
    onReceive(data, creds);
  };

  // 1. Faz uma leitura inicial dos IDs antigos no cache do tópico para ignorar envios de sessões passadas
  const pollCloudTopic = async (isInitialSeed: boolean) => {
    if (stopped) return;
    try {
      const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const text = await res.text();
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          const wrapper = JSON.parse(line);
          if (wrapper?.id && wrapper?.event === 'message' && wrapper?.message) {
            if (isInitialSeed) {
              seenMessageIds.add(wrapper.id);
            } else if (!seenMessageIds.has(wrapper.id)) {
              const inner = JSON.parse(wrapper.message) as PairedPlaylistPayload;
              if (inner && inner.type) {
                handleIncoming(wrapper.id, inner);
              }
            }
          }
        } catch {
          // Ignorar linha malformada
        }
      }
      initializedCacheIds = true;
    } catch {
      // Sem internet no momento
    }
  };

  // Semeia os IDs antigos ao abrir o app e depois faz polling leve a cada 2.5s
  pollCloudTopic(true);
  const cloudPollInterval = window.setInterval(() => {
    if (initializedCacheIds) {
      pollCloudTopic(false);
    } else {
      pollCloudTopic(true);
    }
  }, 2500);

  // 2. Escuta também via EventSource (SSE) para recebimento instantâneo (<100ms)
  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource(`https://ntfy.sh/${topic}/sse`);
    eventSource.onmessage = (event) => {
      try {
        const wrapper = JSON.parse(event.data);
        if (wrapper?.id && wrapper?.message) {
          const inner = JSON.parse(wrapper.message) as PairedPlaylistPayload;
          if (inner && inner.type) {
            handleIncoming(wrapper.id, inner);
          }
        }
      } catch {
        // Ignorar keepalive
      }
    };
  } catch {
    // Fallback automático para o cloudPollInterval acima
  }

  return () => {
    stopped = true;
    window.clearInterval(cloudPollInterval);
    if (eventSource) {
      eventSource.close();
    }
  };
}
