import React, { useEffect, useRef, useState } from 'react';
import { Check, Clapperboard, Folder, FolderOpen, Lock, Maximize2, Play, Star, Tv } from 'lucide-react';
import { Channel, ChannelGroupSummary, PlaybackProgress, SeriesFolderSummary } from '../types/iptv';

const ITEM_HEIGHT = 68;
const VISIBLE_BUFFER = 6;

export type MixedBrowserItem =
  | { kind: 'folder'; folder: SeriesFolderSummary }
  | { kind: 'channel'; channel: Channel };

interface VirtualGroupListProps {
  groups: ChannelGroupSummary[];
  focusedIndex: number;
  isZoneActive: boolean;
  onSelectGroup: (group: ChannelGroupSummary, index: number) => void;
  onFocusIndex: (index: number) => void;
}

export const VirtualGroupList: React.FC<VirtualGroupListProps> = ({
  groups,
  focusedIndex,
  isZoneActive,
  onSelectGroup,
  onFocusIndex,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewportHeight(el.clientHeight || 640);

    const targetTop = focusedIndex * ITEM_HEIGHT;
    const targetBottom = targetTop + ITEM_HEIGHT;
    const currentTop = el.scrollTop;
    const currentBottom = currentTop + el.clientHeight;

    if (targetTop < currentTop + ITEM_HEIGHT) {
      el.scrollTop = Math.max(0, targetTop - ITEM_HEIGHT);
    } else if (targetBottom > currentBottom - ITEM_HEIGHT) {
      el.scrollTop = targetBottom - el.clientHeight + ITEM_HEIGHT;
    }
  }, [focusedIndex]);

  const totalHeight = groups.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - VISIBLE_BUFFER);
  const endIndex = Math.min(
    groups.length - 1,
    Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + VISIBLE_BUFFER
  );

  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const grp = groups[i];
    if (!grp) continue;
    const isFocused = isZoneActive && focusedIndex === i;

    visibleItems.push(
      <div
        key={grp.name}
        style={{
          position: 'absolute',
          top: `${i * ITEM_HEIGHT}px`,
          left: 0,
          right: 0,
          height: `${ITEM_HEIGHT - 6}px`,
        }}
        className={`tv-list-item group-item ${isFocused ? 'dpad-focused' : ''} ${
          grp.isLocked ? 'locked-adult-item' : ''
        }`}
        onClick={() => {
          onFocusIndex(i);
          onSelectGroup(grp, i);
        }}
        onMouseEnter={() => onFocusIndex(i)}
      >
        <div className={`item-icon-box ${grp.isLocked ? 'locked-icon' : ''}`}>
          {grp.isLocked ? (
            <Lock size={19} />
          ) : grp.seriesCount && grp.seriesCount > 0 ? (
            <Clapperboard size={20} />
          ) : (
            <Folder size={20} />
          )}
        </div>
        <div className="item-main-text">
          <span className="item-title">{grp.name}</span>
          {grp.isLocked ? (
            <span className="adult-tag-sub">🔒 Conteúdo Protegido (Senha Parental)</span>
          ) : grp.seriesCount && grp.seriesCount > 0 ? (
            <span className="item-subtitle">
              📁 {grp.seriesCount} séries organizadas ({grp.channelCount} episódios)
            </span>
          ) : (
            <span className="item-subtitle">{grp.channelCount} canais disponíveis</span>
          )}
        </div>
        {isFocused ? (
          <div className="dpad-ok-pill">{grp.isLocked ? '🔒 Senha' : 'OK ➔'}</div>
        ) : (
          <div className="item-count-pill">
            {grp.seriesCount && grp.seriesCount > 0 ? `${grp.seriesCount} 📁` : grp.channelCount}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="virtual-scroll-container"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
        {visibleItems}
      </div>
    </div>
  );
};

interface VirtualMixedListProps {
  items: MixedBrowserItem[];
  activeChannelUrl?: string;
  favoriteUrls: Set<string>;
  playbackProgressMap?: Record<string, PlaybackProgress>;
  focusedIndex: number;
  isZoneActive: boolean;
  onSelectFolder: (folder: SeriesFolderSummary, index: number) => void;
  onSelectChannel: (channel: Channel, index: number) => void;
  onFocusIndex: (index: number) => void;
}

export const VirtualMixedList: React.FC<VirtualMixedListProps> = ({
  items,
  activeChannelUrl,
  favoriteUrls,
  playbackProgressMap,
  focusedIndex,
  isZoneActive,
  onSelectFolder,
  onSelectChannel,
  onFocusIndex,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewportHeight(el.clientHeight || 640);

    const targetTop = focusedIndex * ITEM_HEIGHT;
    const targetBottom = targetTop + ITEM_HEIGHT;
    const currentTop = el.scrollTop;
    const currentBottom = currentTop + el.clientHeight;

    if (targetTop < currentTop + ITEM_HEIGHT) {
      el.scrollTop = Math.max(0, targetTop - ITEM_HEIGHT);
    } else if (targetBottom > currentBottom - ITEM_HEIGHT) {
      el.scrollTop = targetBottom - el.clientHeight + ITEM_HEIGHT;
    }
  }, [focusedIndex]);

  const totalHeight = items.length * ITEM_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - VISIBLE_BUFFER);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + VISIBLE_BUFFER
  );

  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const entry = items[i];
    if (!entry) continue;
    const isFocused = isZoneActive && focusedIndex === i;

    if (entry.kind === 'folder') {
      const folder = entry.folder;
      visibleItems.push(
        <div
          key={`folder-${folder.type}-${folder.name}`}
          style={{
            position: 'absolute',
            top: `${i * ITEM_HEIGHT}px`,
            left: 0,
            right: 0,
            height: `${ITEM_HEIGHT - 6}px`,
          }}
          className={`tv-list-item group-item series-folder-item ${
            isFocused ? 'dpad-focused' : ''
          }`}
          onClick={() => {
            onFocusIndex(i);
            onSelectFolder(folder, i);
          }}
          onMouseEnter={() => onFocusIndex(i)}
        >
          <div className="ch-logo-wrapper series-folder-icon">
            {folder.logo ? (
              <img
                src={folder.logo}
                alt=""
                loading="lazy"
                className="ch-logo-img"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : folder.type === 'season_folder' ? (
              <FolderOpen size={20} color="#f4e154" />
            ) : (
              <Clapperboard size={20} color="#38bdf8" />
            )}
          </div>
          <div className="item-main-text">
            <span className="item-title">📁 {folder.name}</span>
            <span className="item-subtitle">{folder.subtitle}</span>
          </div>
          {isFocused ? (
            <div className="dpad-ok-pill">Abrir Pasta ➔</div>
          ) : (
            <div className="item-count-pill">{folder.count} ep</div>
          )}
        </div>
      );
    } else {
      const ch = entry.channel;
      const isPlaying = activeChannelUrl === ch.url;
      const isFav = favoriteUrls.has(ch.url);
      const progress = playbackProgressMap?.[ch.url];
      const isCompleted = Boolean(progress?.completed);
      const hasProgress = Boolean(progress && !progress.completed && progress.percentage > 0);
      const epTag =
        ch.seasonNumber && ch.episodeNumber
          ? `S${String(ch.seasonNumber).padStart(2, '0')}E${String(ch.episodeNumber).padStart(2, '0')}`
          : String(ch.number).padStart(3, '0');

      visibleItems.push(
        <div
          key={ch.id}
          style={{
            position: 'absolute',
            top: `${i * ITEM_HEIGHT}px`,
            left: 0,
            right: 0,
            height: `${ITEM_HEIGHT - 6}px`,
          }}
          className={`tv-list-item channel-item ${isFocused ? 'dpad-focused' : ''} ${
            isPlaying ? 'now-playing' : ''
          }`}
          onClick={() => {
            onFocusIndex(i);
            onSelectChannel(ch, i);
          }}
          onMouseEnter={() => onFocusIndex(i)}
        >
          <span className="ch-number">{epTag}</span>
          <div className="ch-logo-wrapper">
            {ch.isAdult ? (
              <Lock size={18} color="#f87171" />
            ) : ch.logo ? (
              <img
                src={ch.logo}
                alt=""
                loading="lazy"
                className="ch-logo-img"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Tv size={18} className="ch-logo-fallback" />
            )}
          </div>
          <div className="item-main-text">
            <div className="item-title-row">
              <span className="item-title">{ch.name}</span>
              {isCompleted && (
                <span className="completed-badge-pill">
                  <Check size={11} strokeWidth={3} /> Visto
                </span>
              )}
            </div>
            <span className="item-subtitle">
              {isPlaying
                ? '▶ Reproduzindo no Player ao lado'
                : ch.seriesName
                ? `${ch.seriesName} • Temp. ${ch.seasonNumber || 1} Ep. ${ch.episodeNumber || 1}`
                : ch.group}
            </span>
            {hasProgress && progress && (
              <div className="item-playback-progress-track">
                <div
                  className="item-playback-progress-fill"
                  style={{ width: `${Math.min(100, Math.max(4, progress.percentage))}%` }}
                />
              </div>
            )}
          </div>
          <div className="ch-status-icons">
            {isFav && <Star size={16} fill="#f4e154" color="#f4e154" />}
            {isFocused ? (
              <div className={`dpad-ok-pill ${isPlaying ? 'expand-pill' : 'play-pill'}`}>
                {ch.isAdult ? (
                  '🔒 Senha'
                ) : isPlaying ? (
                  <>
                    <Maximize2 size={12} /> Tela Cheia
                  </>
                ) : (
                  <>
                    <Play size={12} fill="currentColor" /> Assistir
                  </>
                )}
              </div>
            ) : (
              isPlaying && <Play size={16} fill="#38bdf8" color="#38bdf8" />
            )}
          </div>
        </div>
      );
    }
  }

  return (
    <div
      ref={containerRef}
      className="virtual-scroll-container"
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
        {visibleItems}
      </div>
    </div>
  );
};
