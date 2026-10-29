export interface Channel {
  id: string;
  number: number;
  name: string;
  url: string;
  logo?: string;
  group: string;
  tvgId?: string;
  isAdult?: boolean;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  isNextEpisodeSuggestion?: boolean;
  previousEpisodeName?: string;
  playbackProgress?: PlaybackProgress;
}

export interface PlaybackProgress {
  url: string;
  currentTime: number;
  duration: number;
  percentage: number;
  completed: boolean;
  updatedAt: number;
}

export interface ChannelGroupSummary {
  name: string;
  channelCount: number;
  seriesCount?: number;
  isLocked?: boolean;
}

export interface SeriesFolderSummary {
  type: 'series_folder' | 'season_folder';
  name: string;
  subtitle: string;
  count: number;
  logo?: string;
  seasonNumber?: number;
  isLocked?: boolean;
}

export interface XtreamCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export type PlayerEngineMode = 'auto' | 'html5_hls' | 'tizen_avplay';

export type NavigationTab =
  | 'groups'
  | 'channels'
  | 'favorites'
  | 'recent'
  | 'search'
  | 'qrcode'
  | 'settings';
