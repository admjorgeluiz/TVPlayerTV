import { Channel, ChannelGroupSummary, XtreamCredentials } from '../types/iptv';

// Regex pré-compilada em C++ (V8) para detecção ultra-rápida de conteúdo +18
const ADULT_REGEX =
  /xxx|adulto|adult|porn|sexy|18\+|\+18|erot|for men|bella|privad|venus/i;

// Expressões regulares para identificar estrutura de Séries/Novelas (S01E01, S01 E01, T01E01, 1x01, Temporada X, Cap. X)
const SERIES_SXXEXX_REGEX =
  /^(.+?)(?:[\s._-]+)(?:S|T)(\d{1,2})[\s._-]*E(?:P|PISODIO|PISÓDIO)?\s*(\d{1,4})\b/i;
const SERIES_NXN_REGEX = /^(.+?)(?:[\s._-]+)(\d{1,2})x(\d{1,4})\b/i;
const SERIES_TEMP_CAP_REGEX =
  /^(.+?)(?:[\s._-]+)(?:(?:Temporada|Season)\s*(\d{1,2})(?:[\s._-]*(?:Ep|Episodio|Episódio|E)\.?\s*(\d{1,4}))?|Cap(?:\.|ítulo|itulo)?\s*(\d{1,4}))\b/i;

// Cache em memória por nome de categoria
const groupAdultCache = new Map<string, boolean>();

// Collator único instanciado uma só vez para ordenação instantânea
export const ptCollator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

export function isAdultGroup(groupName?: string): boolean {
  if (!groupName) return false;
  const cached = groupAdultCache.get(groupName);
  if (cached !== undefined) return cached;
  const result = ADULT_REGEX.test(groupName);
  groupAdultCache.set(groupName, result);
  return result;
}

export function isAdultContent(name?: string, group?: string): boolean {
  if (group && isAdultGroup(group)) return true;
  if (!name) return false;
  return ADULT_REGEX.test(name);
}

export function extractSeriesInfo(name: string): {
  seriesName: string;
  seasonNumber: number;
  episodeNumber: number;
} | null {
  let m = SERIES_SXXEXX_REGEX.exec(name);
  if (m) {
    const cleanTitle = m[1].replace(/[\s\-–:|]+$/, '').trim();
    if (cleanTitle) {
      return {
        seriesName: cleanTitle,
        seasonNumber: parseInt(m[2], 10) || 1,
        episodeNumber: parseInt(m[3], 10) || 1,
      };
    }
  }

  m = SERIES_NXN_REGEX.exec(name);
  if (m) {
    const cleanTitle = m[1].replace(/[\s\-–:|]+$/, '').trim();
    if (cleanTitle) {
      return {
        seriesName: cleanTitle,
        seasonNumber: parseInt(m[2], 10) || 1,
        episodeNumber: parseInt(m[3], 10) || 1,
      };
    }
  }

  m = SERIES_TEMP_CAP_REGEX.exec(name);
  if (m) {
    const cleanTitle = m[1].replace(/[\s\-–:|]+$/, '').trim();
    if (cleanTitle) {
      return {
        seriesName: cleanTitle,
        seasonNumber: m[2] ? parseInt(m[2], 10) || 1 : 1,
        episodeNumber: m[3]
          ? parseInt(m[3], 10) || 1
          : m[4]
          ? parseInt(m[4], 10) || 1
          : 1,
      };
    }
  }

  return null;
}

export const DEMO_CHANNELS: Channel[] = [
  {
    id: 'demo-1',
    number: 1,
    name: 'Red Bull TV (Full HD 1080p)',
    group: 'Esportes & Ação',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Red_Bull_TV_logo.svg/512px-Red_Bull_TV_logo.svg.png',
    url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
  },
  {
    id: 'demo-2',
    number: 2,
    name: 'NASA TV Public (Espaço Ao Vivo)',
    group: 'Ciência & Documentários',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/512px-NASA_logo.svg.png',
    url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
  },
  {
    id: 'demo-3',
    number: 3,
    name: 'DW English (Notícias Internacionais)',
    group: 'Notícias',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_symbol_2012.svg/512px-Deutsche_Welle_symbol_2012.svg.png',
    url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
  },
  {
    id: 'demo-4',
    number: 4,
    name: 'France 24 English (Ao Vivo)',
    group: 'Notícias',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/France24.png/512px-France24.png',
    url: 'https://Amg00106-france24-france24-english-ono-09432.agi.amagi.tv/playlist/amg00106-france24-france24-english-ono/playlist.m3u8',
  },
  {
    id: 'demo-5',
    number: 5,
    name: 'Big Buck Bunny (Teste 4K / VOD)',
    group: 'Cinema & Testes VOD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/400px-Big_buck_bunny_poster_big.jpg',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    id: 'demo-6',
    number: 6,
    name: 'Tears of Steel (Sci-Fi Open Movie)',
    group: 'Cinema & Testes VOD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Tos-poster.png/400px-Tos-poster.png',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
  },
  {
    id: 'demo-7',
    number: 7,
    name: 'Sintel (Animação HD)',
    group: 'Cinema & Testes VOD',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Sintel_poster.jpg/400px-Sintel_poster.jpg',
    url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
  },
];

export function buildXtreamM3uUrl(creds: XtreamCredentials): string {
  const base = creds.serverUrl.trim().replace(/\/+$/, '');
  const u = encodeURIComponent(creds.username.trim());
  const p = encodeURIComponent(creds.password.trim());
  return `${base}/get.php?username=${u}&password=${p}&type=m3u_plus&output=m3u8`;
}

export function buildGroupSummaries(channels: Channel[]): ChannelGroupSummary[] {
  const countMap = new Map<string, number>();
  const seriesSetMap = new Map<string, Set<string>>();

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const group = ch.group || 'Sem Grupo';
    countMap.set(group, (countMap.get(group) || 0) + 1);
    if (ch.seriesName) {
      let sSet = seriesSetMap.get(group);
      if (!sSet) {
        sSet = new Set<string>();
        seriesSetMap.set(group, sSet);
      }
      sSet.add(ch.seriesName);
    }
  }

  return Array.from(countMap.entries())
    .sort((a, b) => ptCollator.compare(a[0], b[0]))
    .map(([name, channelCount]) => ({
      name,
      channelCount,
      seriesCount: seriesSetMap.get(name)?.size || 0,
      isLocked: isAdultGroup(name),
    }));
}

const ATTR_REGEX = /([\w-]+)="(.*?)"/g;

export async function parseM3uFromUrl(
  url: string,
  onProgress?: (status: string) => void
): Promise<Channel[]> {
  onProgress?.('Baixando a lista de canais...');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Servidor retornou HTTP ${response.status} (${response.statusText})`);
  }

  const rawText = await response.text();
  return parseM3uContent(rawText, onProgress);
}

export async function parseM3uContent(
  rawText: string,
  onProgress?: (status: string) => void
): Promise<Channel[]> {
  onProgress?.('Processando canais e organizando pastas de séries...');

  const lines = rawText.split(/\r?\n/);
  const channels: Channel[] = [];
  let currentChannel: Partial<Channel> | null = null;
  let channelCount = 0;

  const CHUNK_SIZE = 30000;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      currentChannel = {
        group: 'Sem Grupo',
      };

      const colonIdx = line.indexOf(':');
      const infoString = colonIdx !== -1 ? line.substring(colonIdx + 1).trim() : line;
      const lastCommaIdx = infoString.lastIndexOf(',');

      if (lastCommaIdx !== -1) {
        const displayName = infoString.substring(lastCommaIdx + 1).trim();
        currentChannel.name = displayName || 'Canal Sem Nome';

        const attributesString = infoString.substring(0, lastCommaIdx);
        ATTR_REGEX.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = ATTR_REGEX.exec(attributesString)) !== null) {
          const key = match[1].toLowerCase();
          const value = match[2].trim();
          if (!value) continue;

          switch (key) {
            case 'tvg-name':
              if (!currentChannel.name || currentChannel.name === 'Canal Sem Nome') {
                currentChannel.name = value;
              }
              break;
            case 'tvg-logo':
              currentChannel.logo = value;
              break;
            case 'group-title':
              currentChannel.group = value;
              break;
            case 'tvg-id':
              currentChannel.tvgId = value;
              break;
          }
        }
      } else {
        currentChannel.name = infoString || `Canal ${channelCount + 1}`;
      }
    } else if (line.startsWith('#EXTGRP:') && currentChannel) {
      const grp = line.substring(8).trim();
      if (grp) currentChannel.group = grp;
    } else if (!line.startsWith('#') && currentChannel) {
      if (line.startsWith('http://') || line.startsWith('https://')) {
        channelCount++;
        const chName = currentChannel.name || `Canal ${channelCount}`;
        const chGroup = currentChannel.group || 'Sem Grupo';
        const seriesInfo = extractSeriesInfo(chName);

        channels.push({
          id: `ch-${channelCount}`,
          number: channelCount,
          name: chName,
          url: line,
          logo: currentChannel.logo,
          group: chGroup,
          tvgId: currentChannel.tvgId,
          isAdult: isAdultContent(chName, chGroup),
          seriesName: seriesInfo?.seriesName,
          seasonNumber: seriesInfo?.seasonNumber,
          episodeNumber: seriesInfo?.episodeNumber,
        });
        currentChannel = null;

        if (channelCount % 10000 === 0) {
          onProgress?.(`Processando... ${channelCount.toLocaleString('pt-BR')} itens lidos.`);
        }
      }
    }

    if (i > 0 && i % CHUNK_SIZE === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return channels;
}
