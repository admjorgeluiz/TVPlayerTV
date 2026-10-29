import { Channel } from '../types/iptv';

/**
 * Localiza o próximo episódio de uma série dentro do acervo de canais:
 * 1. Primeiro tenta achar S(atual) E(atual + 1)
 * 2. Se a temporada acabou, tenta achar S(atual + 1) E(1 ou 0)
 */
export function findNextEpisode(
  currentChannel: Channel,
  allChannels: Channel[]
): Channel | null {
  if (!currentChannel.seriesName) return null;

  const currentSeries = currentChannel.seriesName.trim().toLowerCase();
  const currentSeason = currentChannel.seasonNumber ?? 1;
  const currentEpisode = currentChannel.episodeNumber ?? 0;

  // 1. Procurar o próximo episódio da mesma temporada
  const nextInSameSeason = allChannels.find(
    (c) =>
      c.seriesName &&
      c.seriesName.trim().toLowerCase() === currentSeries &&
      (c.seasonNumber ?? 1) === currentSeason &&
      c.episodeNumber === currentEpisode + 1
  );

  if (nextInSameSeason) return nextInSameSeason;

  // 2. Procurar o primeiro episódio da próxima temporada
  const nextInNextSeason = allChannels.find(
    (c) =>
      c.seriesName &&
      c.seriesName.trim().toLowerCase() === currentSeries &&
      c.seasonNumber === currentSeason + 1 &&
      (c.episodeNumber === 1 || c.episodeNumber === 0)
  );

  return nextInNextSeason || null;
}
