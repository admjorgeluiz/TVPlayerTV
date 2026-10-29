import { Channel } from '../types/iptv';

/**
 * Calcula de forma flexível se um conteúdo VOD (filme ou episódio) foi concluído,
 * adaptando a margem de acordo com a duração total do vídeo:
 * - Até 30 min (<= 1800s, ex: séries de ~20 min): >= 95% assistido ou restando <= 45s
 * - De 30 a 60 min (1800s a 3600s): >= 93% assistido ou restando <= 90s
 * - Acima de 60 min (> 3600s, filmes longos): >= 90% assistido ou restando <= 150s
 */
export function isVodCompleted(currentTime: number, duration: number): boolean {
  if (!Number.isFinite(duration) || duration <= 60 || currentTime <= 0) return false;
  const ratio = currentTime / duration;
  const remaining = duration - currentTime;

  if (duration <= 1800) {
    return ratio >= 0.95 || remaining <= 45;
  }
  if (duration <= 3600) {
    return ratio >= 0.93 || remaining <= 90;
  }
  return ratio >= 0.9 || remaining <= 150;
}

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
