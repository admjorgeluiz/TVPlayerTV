import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Compass,
  Cpu,
  Eye,
  EyeOff,
  FolderKanban,
  KeyRound,
  ListVideo,
  Lock,
  Maximize2,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  Channel,
  ChannelGroupSummary,
  NavigationTab,
  PlayerEngineMode,
  SeriesFolderSummary,
  XtreamCredentials,
} from './types/iptv';
import {
  buildGroupSummaries,
  DEMO_CHANNELS,
  parseM3uContent,
  parseM3uFromUrl,
  ptCollator,
} from './services/m3uParser';
import { storageService } from './services/storageService';
import { channelCacheService } from './services/channelCacheService';
import { exitTizenApp, initTizenTV, isTvBackKey, TIZEN_KEYS } from './services/tizenBridge';
import {
  getOrCreatePairingCode,
  subscribeToPairingCode,
} from './services/pairingService';
import {
  MixedBrowserItem,
  VirtualGroupList,
  VirtualMixedList,
} from './components/VirtualList';
import { VideoPlayer } from './components/VideoPlayer';
import { PlaylistModal } from './components/PlaylistModal';
import { MobileRemoteSetup } from './components/MobileRemoteSetup';
import { ParentalPinModal, PinModalMode } from './components/ParentalPinModal';

type FocusZone =
  | 'nav_rail'
  | 'header_qr_btn'
  | 'search_input'
  | 'back_groups_btn'
  | 'list'
  | 'stage_card'
  | 'fullscreen_player';

const NAV_ITEMS: { id: NavigationTab; label: string; icon: React.ReactNode }[] = [
  { id: 'groups', label: 'Categorias', icon: <FolderKanban size={20} /> },
  { id: 'channels', label: 'Todos Canais', icon: <ListVideo size={20} /> },
  { id: 'favorites', label: 'Favoritos', icon: <Star size={20} /> },
  { id: 'recent', label: 'Recentes', icon: <Clock size={20} /> },
  { id: 'settings', label: 'Configurações', icon: <Settings size={20} /> },
  { id: 'qrcode', label: 'QR / Lista', icon: <QrCode size={20} /> },
];

export function App() {
  const [remotePairParam, setRemotePairParam] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('pair');
    if (code) return code.trim().toUpperCase();
    if (window.location.pathname.toLowerCase().includes('/remote')) {
      return getOrCreatePairingCode();
    }
    return null;
  });

  const [pairingCode] = useState<string>(() => getOrCreatePairingCode());

  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [groupSummaries, setGroupSummaries] = useState<ChannelGroupSummary[]>([]);

  // Estados de Navegação em Pastas: Categoria -> Série (S01E01) -> Temporada -> Episódios
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [selectedSeriesName, setSelectedSeriesName] = useState<string | null>(null);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | null>(null);

  const [unlockedGroupName, setUnlockedGroupName] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  // Por padrão, canais protegidos (+18) começam OCULTOS e só aparecem após ativar o selo +18 nas Configurações com senha!
  const [showAdultContent, setShowAdultContent] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<NavigationTab>('groups');
  const [isShowingGroups, setIsShowingGroups] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  const [m3uUrl, setM3uUrl] = useState<string>(() => storageService.getLastM3uUrl());
  const [xtreamCreds, setXtreamCreds] = useState<XtreamCredentials>(() =>
    storageService.getXtreamCreds()
  );
  const [engineMode, setEngineMode] = useState<PlayerEngineMode>(() =>
    storageService.getPlayerEngine()
  );

  const [favoriteUrls, setFavoriteUrls] = useState<string[]>(() => storageService.getFavorites());
  const [recentUrls, setRecentUrls] = useState<string[]>(() => storageService.getRecents());

  const [searchText, setSearchText] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [confirmExitToast, setConfirmExitToast] = useState<boolean>(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);

  // Estado do Modal de Controle Parental (Verificação ou Alteração de Senha)
  const [pinRequest, setPinRequest] = useState<{
    mode?: PinModalMode;
    title: string;
    onVerified: () => void;
  } | null>(null);

  // Estados de Navegação Espacial (Controle Remoto D-Pad da Samsung TV)
  const [focusZone, setFocusZone] = useState<FocusZone>('list');
  const [navRailIndex, setNavRailIndex] = useState<number>(0);
  const [listFocusIndex, setListFocusIndex] = useState<number>(0);
  const [numericBuffer, setNumericBuffer] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const numericTimerRef = useRef<number | null>(null);

  const showTemporaryFeedback = useCallback((msg: string) => {
    setSettingsFeedback(msg);
    window.setTimeout(() => {
      setSettingsFeedback((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  useEffect(() => {
    if (!remotePairParam) {
      initTizenTV();
    }
  }, [remotePairParam]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim().toLowerCase());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    if (activeTab === 'settings') return;
    if (debouncedSearch.length > 0) {
      setIsShowingGroups(false);
      setListFocusIndex(0);
    } else if (activeTab === 'groups' && !selectedGroupName) {
      setIsShowingGroups(true);
    }
  }, [debouncedSearch, activeTab, selectedGroupName]);

  const handleLoadM3uFromUrl = useCallback(
    async (targetUrl: string, credsToSave?: XtreamCredentials) => {
      const cleanUrl = targetUrl.trim();
      if (!cleanUrl) return;

      setSelectedChannel(null);
      setIsFullScreen(false);
      setIsLoading(true);
      setLoadingStatus('Baixando sua lista de canais...');
      setIsModalOpen(false);

      try {
        const parsed = await parseM3uFromUrl(cleanUrl, (status) => {
          setLoadingStatus(status);
        });

        if (parsed.length === 0) {
          throw new Error('Nenhum canal válido foi encontrado nesta URL.');
        }

        const summaries = buildGroupSummaries(parsed);

        setAllChannels(parsed);
        setGroupSummaries(summaries);
        setSelectedGroupName(null);
        setSelectedSeriesName(null);
        setSelectedSeasonNumber(null);
        setUnlockedGroupName(null);
        setIsShowingGroups(true);
        setActiveTab('groups');
        setNavRailIndex(0);
        setListFocusIndex(0);
        setFocusZone('list');
        setM3uUrl(cleanUrl);
        storageService.setLastM3uUrl(cleanUrl);

        if (credsToSave) {
          setXtreamCreds(credsToSave);
          storageService.setXtreamCreds(credsToSave);
        }
      } catch (err: any) {
        setLoadingStatus(`Falha ao carregar: ${err?.message || 'Erro de conexão/CORS'}`);
        await new Promise((r) => setTimeout(r, 3500));
      } finally {
        setIsLoading(false);
        setLoadingStatus('');
      }
    },
    []
  );

  const handleLoadRawContent = useCallback(async (rawText: string) => {
    setSelectedChannel(null);
    setIsFullScreen(false);
    setIsLoading(true);
    setLoadingStatus('Analisando lista M3U recebida...');
    setIsModalOpen(false);
    try {
      const parsed = await parseM3uContent(rawText, (status) => setLoadingStatus(status));
      if (parsed.length === 0) {
        throw new Error('Arquivo não contém canais válidos.');
      }
      const summaries = buildGroupSummaries(parsed);
      setAllChannels(parsed);
      setGroupSummaries(summaries);
      setSelectedGroupName(null);
      setSelectedSeriesName(null);
      setSelectedSeasonNumber(null);
      setUnlockedGroupName(null);
      setIsShowingGroups(true);
      setActiveTab('groups');
      setNavRailIndex(0);
      setListFocusIndex(0);
      setFocusZone('list');
    } catch (err: any) {
      setLoadingStatus(`Erro no arquivo: ${err?.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  }, []);

  const handleLoadDemo = useCallback(() => {
    setSelectedChannel(null);
    setAllChannels(DEMO_CHANNELS);
    setGroupSummaries(buildGroupSummaries(DEMO_CHANNELS));
    setSelectedGroupName(null);
    setSelectedSeriesName(null);
    setSelectedSeasonNumber(null);
    setUnlockedGroupName(null);
    setIsShowingGroups(true);
    setActiveTab('groups');
    setNavRailIndex(0);
    setListFocusIndex(0);
    setFocusZone('list');
    setIsModalOpen(false);
  }, []);

  useEffect(() => {
    if (remotePairParam) return;
    const unsubscribe = subscribeToPairingCode(pairingCode, (payload, creds) => {
      if (payload.type === 'm3u_content' && payload.rawContent) {
        handleLoadRawContent(payload.rawContent);
      } else if (payload.m3uUrl) {
        handleLoadM3uFromUrl(payload.m3uUrl, creds);
      }
    });
    return () => unsubscribe();
  }, [remotePairParam, pairingCode, handleLoadM3uFromUrl, handleLoadRawContent]);

  useEffect(() => {
    if (remotePairParam) return;
    channelCacheService.clearCache().catch(() => {});

    const savedUrl = storageService.getLastM3uUrl();
    if (savedUrl) {
      handleLoadM3uFromUrl(savedUrl);
    } else {
      setFocusZone('list');
      setListFocusIndex(0);
    }
  }, [remotePairParam, handleLoadM3uFromUrl]);

  // Filtra canais e grupos +18 quando o Selo +18 está desativado (padrão = oculto!)
  const visibleChannelsPool = useMemo(() => {
    if (showAdultContent) return allChannels;
    return allChannels.filter((c) => !c.isAdult);
  }, [allChannels, showAdultContent]);

  const visibleGroupSummaries = useMemo(() => {
    if (showAdultContent) return groupSummaries;
    return groupSummaries.filter((g) => !g.isLocked);
  }, [groupSummaries, showAdultContent]);

  const favoriteSet = useMemo(() => new Set(favoriteUrls), [favoriteUrls]);

  // Último canal assistido (para o botão "Continuar Assistindo" no centro da tela)
  const lastWatchedChannel = useMemo(() => {
    if (recentUrls.length === 0 || visibleChannelsPool.length === 0) return null;
    const lastUrl = recentUrls[0];
    return visibleChannelsPool.find((c) => c.url === lastUrl && !c.isAdult) || null;
  }, [recentUrls, visibleChannelsPool]);

  /**
   * Constrói os itens visíveis na lista (Pastas de Séries S01E01, Pastas de Temporadas ou Canais/Episódios)
   */
  const mixedItemsInView = useMemo<MixedBrowserItem[]>(() => {
    // 1. Modo de Busca Global: se o usuário digitou na busca, mostra Pastas de Séries encontradas + Canais encontrados
    if (debouncedSearch.length > 0) {
      const matchedChannels = visibleChannelsPool.filter(
        (c) =>
          c.name.toLowerCase().includes(debouncedSearch) ||
          c.group.toLowerCase().includes(debouncedSearch) ||
          (c.seriesName && c.seriesName.toLowerCase().includes(debouncedSearch))
      );

      // Se estamos dentro de um grupo específico sem série selecionada, agrupa séries na busca também
      if (selectedGroupName && !selectedSeriesName) {
        const inGroup = matchedChannels.filter(
          (c) => (c.group || 'Sem Grupo') === selectedGroupName
        );
        return buildMixedFolderAndChannelItems(inGroup);
      }

      return matchedChannels.map((channel) => ({ kind: 'channel', channel }));
    }

    // 2. Aba Favoritos
    if (activeTab === 'favorites') {
      return visibleChannelsPool
        .filter((c) => favoriteSet.has(c.url))
        .map((channel) => ({ kind: 'channel', channel }));
    }

    // 3. Aba Recentes
    if (activeTab === 'recent') {
      const byUrl = new Map(visibleChannelsPool.map((c) => [c.url, c]));
      return recentUrls
        .map((u) => byUrl.get(u))
        .filter((c): c is Channel => Boolean(c))
        .map((channel) => ({ kind: 'channel', channel }));
    }

    // 4. Aba Todos os Canais
    if (activeTab === 'channels') {
      return visibleChannelsPool.map((channel) => ({ kind: 'channel', channel }));
    }

    // 5. Dentro de uma Categoria (selectedGroupName) -> Organiza vídeos S01E01 em Pastas de Séries e Temporadas!
    if (selectedGroupName) {
      const groupChannels = visibleChannelsPool.filter(
        (c) => (c.group || 'Sem Grupo') === selectedGroupName
      );

      // Nível 3: Usuário abriu uma Série E escolheu uma Temporada específica -> Mostra episódios daquela temporada ordenados!
      if (selectedSeriesName && selectedSeasonNumber !== null) {
        const episodes = groupChannels
          .filter(
            (c) =>
              c.seriesName === selectedSeriesName &&
              (c.seasonNumber || 1) === selectedSeasonNumber
          )
          .sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));

        return episodes.map((channel) => ({ kind: 'channel', channel }));
      }

      // Nível 2: Usuário abriu a Pasta de uma Série (selectedSeriesName)
      if (selectedSeriesName) {
        const seriesEpisodes = groupChannels.filter((c) => c.seriesName === selectedSeriesName);
        const seasonsMap = new Map<number, Channel[]>();

        for (const ep of seriesEpisodes) {
          const sNum = ep.seasonNumber || 1;
          const list = seasonsMap.get(sNum) || [];
          list.push(ep);
          seasonsMap.set(sNum, list);
        }

        // Se a série tem 2 ou mais temporadas (ex: S01, S02), exibe as Pastas de Temporadas!
        if (seasonsMap.size > 1) {
          const sortedSeasons = Array.from(seasonsMap.entries()).sort((a, b) => a[0] - b[0]);
          return sortedSeasons.map(([seasonNum, eps]) => ({
            kind: 'folder',
            folder: {
              type: 'season_folder',
              name: `Temporada ${String(seasonNum).padStart(2, '0')}`,
              subtitle: `${selectedSeriesName} • ${eps.length} episódios disponíveis`,
              count: eps.length,
              logo: eps.find((e) => e.logo)?.logo,
              seasonNumber: seasonNum,
            },
          }));
        }

        // Se a série tem apenas 1 temporada, já lista todos os episódios em ordem numérica (E01, E02...)!
        const sortedEpisodes = [...seriesEpisodes].sort(
          (a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0)
        );
        return sortedEpisodes.map((channel) => ({ kind: 'channel', channel }));
      }

      // Nível 1: Dentro da Categoria -> Agrupa todos os vídeos S01E01 em Pastas por Nome da Série!
      return buildMixedFolderAndChannelItems(groupChannels);
    }

    return visibleChannelsPool.map((channel) => ({ kind: 'channel', channel }));
  }, [
    visibleChannelsPool,
    debouncedSearch,
    activeTab,
    selectedGroupName,
    selectedSeriesName,
    selectedSeasonNumber,
    favoriteSet,
    recentUrls,
  ]);

  // Canais reproduzíveis na visualização atual (para CH+/CH-)
  const playableChannelsInView = useMemo(() => {
    return mixedItemsInView
      .filter((item): item is { kind: 'channel'; channel: Channel } => item.kind === 'channel')
      .map((item) => item.channel);
  }, [mixedItemsInView]);

  const headerTitle = useMemo(() => {
    if (activeTab === 'settings') {
      return 'Configurações & Controle Parental';
    }
    if (allChannels.length === 0) {
      return 'Configuração Inicial';
    }
    if (debouncedSearch.length > 0) {
      return `Busca: "${searchText}" (${mixedItemsInView.length})`;
    }
    if (activeTab === 'favorites') {
      return `Canais Favoritos (${mixedItemsInView.length})`;
    }
    if (activeTab === 'recent') {
      return `Assistidos Recentemente (${mixedItemsInView.length})`;
    }
    if (activeTab === 'channels') {
      return `Todos os Canais (${visibleChannelsPool.length.toLocaleString('pt-BR')})`;
    }
    if (isShowingGroups) {
      return `Categorias (${visibleGroupSummaries.length})`;
    }
    if (selectedSeriesName && selectedSeasonNumber !== null) {
      return `${selectedSeriesName} • Temp. ${String(selectedSeasonNumber).padStart(2, '0')} (${mixedItemsInView.length})`;
    }
    if (selectedSeriesName) {
      return `📁 ${selectedSeriesName} (${mixedItemsInView.length})`;
    }
    return `${selectedGroupName || 'Canais'} (${mixedItemsInView.length})`;
  }, [
    activeTab,
    allChannels.length,
    debouncedSearch,
    searchText,
    mixedItemsInView.length,
    visibleChannelsPool.length,
    isShowingGroups,
    visibleGroupSummaries.length,
    selectedGroupName,
    selectedSeriesName,
    selectedSeasonNumber,
  ]);

  // Texto dinâmico do botão de Voltar (mostra exatamente para qual pasta o usuário vai voltar!)
  const backButtonLabel = useMemo(() => {
    if (selectedSeriesName && selectedSeasonNumber !== null) {
      return `◄ Voltar para ${selectedSeriesName}`;
    }
    if (selectedSeriesName) {
      return `◄ Voltar para ${selectedGroupName || 'Categoria'}`;
    }
    return '◄ Voltar às Categorias';
  }, [selectedGroupName, selectedSeriesName, selectedSeasonNumber]);

  // Indicador visual claro de onde está o foco do controle remoto
  const focusContextInfo = useMemo(() => {
    if (focusZone === 'stage_card') {
      return {
        where: 'Continuar Assistindo',
        hint: 'OK Reproduzir Último Canal • ◄ Voltar para a Lista',
      };
    }
    if (focusZone === 'nav_rail') {
      return {
        where: 'Menu Lateral',
        hint: '▲▼ Mudar Aba • ► Entrar na Aba',
      };
    }
    if (focusZone === 'header_qr_btn') {
      return {
        where: 'Botão QR / Lista',
        hint: 'OK Abrir QR Code • ▼ Ir para Busca',
      };
    }
    if (focusZone === 'search_input') {
      return {
        where: 'Barra de Busca',
        hint: 'OK Digitar • ▼ Descer para Lista • ▲ Subir p/ QR',
      };
    }
    if (focusZone === 'back_groups_btn') {
      return {
        where: 'Voltar Nível',
        hint: 'OK ou ◄ Voltar Pasta • ▼ Descer para Lista',
      };
    }
    if (activeTab === 'settings') {
      return {
        where: 'Configurações',
        hint: '▲▼ Escolher Opção • OK Alterar / Confirmar • ◄ Menu Lateral',
      };
    }
    if (allChannels.length === 0) {
      return {
        where: 'Boas-Vindas',
        hint: '▲▼ Escolher Opção • OK Confirmar • 🔵 Abrir QR Code',
      };
    }
    if (isShowingGroups) {
      return {
        where: 'Lista de Categorias',
        hint: lastWatchedChannel
          ? '▲▼ Navegar • OK Abrir • ► Ir p/ Continuar Assistindo'
          : '▲▼ Navegar • OK Abrir Categoria • ◄ Menu Lateral',
      };
    }
    if (selectedSeriesName) {
      return {
        where: `Série: ${selectedSeriesName}`,
        hint: '▲▼ Escolher Temp./Episódio • OK Abrir • ◄ Voltar Pasta',
      };
    }
    return {
      where: selectedGroupName ? `Categoria: ${selectedGroupName}` : 'Lista de Canais',
      hint: '▲▼ Escolher Pasta/Canal • OK Abrir • ◄ Voltar',
    };
  }, [
    focusZone,
    activeTab,
    allChannels.length,
    isShowingGroups,
    selectedGroupName,
    selectedSeriesName,
    lastWatchedChannel,
  ]);

  const handleRequestToggleAdultContent = useCallback(() => {
    if (showAdultContent) {
      setShowAdultContent(false);
      storageService.setShowAdultContent(false);
      setUnlockedGroupName(null);
      if (selectedGroupName) {
        const currentGrp = groupSummaries.find((g) => g.name === selectedGroupName);
        if (currentGrp?.isLocked) {
          setSelectedGroupName(null);
          setSelectedSeriesName(null);
          setSelectedSeasonNumber(null);
          setIsShowingGroups(true);
        }
      }
      if (selectedChannel?.isAdult) {
        setSelectedChannel(null);
      }
      showTemporaryFeedback('🔒 Selo +18 desativado: Canais protegidos foram ocultados da lista.');
    } else {
      setPinRequest({
        mode: 'verify',
        title: 'Ativar Selo +18 (Mostrar Canais Protegidos)',
        onVerified: () => {
          setPinRequest(null);
          setShowAdultContent(true);
          storageService.setShowAdultContent(true);
          showTemporaryFeedback(
            '🔞 Selo +18 ativado! Os canais protegidos agora aparecem na lista (com senha ao abrir).'
          );
        },
      });
    }
  }, [showAdultContent, selectedGroupName, groupSummaries, selectedChannel, showTemporaryFeedback]);

  const handleOpenChangePinKeypad = useCallback(() => {
    setPinRequest({
      mode: 'change_pin',
      title: 'Atualizar Senha Parental',
      onVerified: () => {
        setPinRequest(null);
        showTemporaryFeedback('✅ Senha Parental atualizada com sucesso!');
      },
    });
  }, [showTemporaryFeedback]);

  const handleSelectGroup = useCallback((group: ChannelGroupSummary) => {
    const openGroupNow = () => {
      setSelectedGroupName(group.name);
      setSelectedSeriesName(null);
      setSelectedSeasonNumber(null);
      setIsShowingGroups(false);
      setListFocusIndex(0);
      setFocusZone('list');
    };

    if (group.isLocked) {
      setPinRequest({
        mode: 'verify',
        title: `Categoria: ${group.name}`,
        onVerified: () => {
          setPinRequest(null);
          setUnlockedGroupName(group.name);
          openGroupNow();
        },
      });
      return;
    }

    openGroupNow();
  }, []);

  // Abrir uma Pasta de Série ou Pasta de Temporada
  const handleSelectFolder = useCallback((folder: SeriesFolderSummary) => {
    if (folder.type === 'series_folder') {
      setSelectedSeriesName(folder.name);
      setSelectedSeasonNumber(null);
      setListFocusIndex(0);
      setFocusZone('list');
    } else if (folder.type === 'season_folder' && folder.seasonNumber !== undefined) {
      setSelectedSeasonNumber(folder.seasonNumber);
      setListFocusIndex(0);
      setFocusZone('list');
    }
  }, []);

  // Voltar um nível na hierarquia de pastas (Episódios -> Temporadas -> Séries -> Categorias)
  const handleStepBackHierarchy = useCallback(() => {
    if (selectedSeasonNumber !== null) {
      setSelectedSeasonNumber(null);
      setListFocusIndex(0);
      setFocusZone('list');
      return;
    }
    if (selectedSeriesName !== null) {
      setSelectedSeriesName(null);
      setListFocusIndex(0);
      setFocusZone('list');
      return;
    }
    setSelectedGroupName(null);
    setUnlockedGroupName(null);
    setSearchText('');
    setDebouncedSearch('');
    setActiveTab('groups');
    setIsShowingGroups(true);
    setListFocusIndex(0);
    setFocusZone('list');
  }, [selectedSeasonNumber, selectedSeriesName]);

  const handleSelectChannel = useCallback(
    (channel: Channel) => {
      const playChannelNow = () => {
        if (selectedChannel?.url === channel.url) {
          setIsFullScreen(true);
          setFocusZone('fullscreen_player');
          return;
        }
        setSelectedChannel(channel);
        const updatedRecents = storageService.addRecent(channel.url);
        setRecentUrls(updatedRecents);
      };

      if (channel.isAdult) {
        setPinRequest({
          mode: 'verify',
          title: `Canal: ${channel.name}`,
          onVerified: () => {
            setPinRequest(null);
            playChannelNow();
          },
        });
        return;
      }

      playChannelNow();
    },
    [selectedChannel]
  );

  const handleToggleFavorite = useCallback((targetChannel?: Channel | null) => {
    const ch = targetChannel;
    if (!ch) return;
    const updated = storageService.toggleFavorite(ch.url);
    setFavoriteUrls(updated);
  }, []);

  const handleSwitchEngineMode = useCallback(() => {
    const order: PlayerEngineMode[] = ['auto', 'html5_hls', 'tizen_avplay'];
    setEngineMode((prev) => {
      const next = order[(order.indexOf(prev) + 1) % order.length];
      storageService.setPlayerEngine(next);
      return next;
    });
  }, []);

  const handleChannelStep = useCallback(
    (delta: number) => {
      const pool = playableChannelsInView.length > 0 ? playableChannelsInView : visibleChannelsPool;
      if (pool.length === 0) return;
      const currentIndex = selectedChannel
        ? pool.findIndex((c) => c.url === selectedChannel.url)
        : 0;
      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + delta + pool.length) % pool.length;
      const nextChannel = pool[nextIndex];
      if (nextChannel) {
        handleSelectChannel(nextChannel);
      }
    },
    [playableChannelsInView, visibleChannelsPool, selectedChannel, handleSelectChannel]
  );

  const handleActivateNavTab = useCallback((tabId: NavigationTab, idx: number) => {
    setNavRailIndex(idx);
    if (tabId === 'qrcode') {
      setIsModalOpen(true);
      return;
    }
    setActiveTab(tabId);
    setSearchText('');
    setDebouncedSearch('');
    setUnlockedGroupName(null);
    setSelectedSeriesName(null);
    setSelectedSeasonNumber(null);
    if (tabId === 'groups') {
      setSelectedGroupName(null);
      setIsShowingGroups(true);
    } else {
      setIsShowingGroups(false);
    }
    setListFocusIndex(0);
  }, []);

  const isBackToGroupsVisible =
    !isShowingGroups && activeTab === 'groups' && allChannels.length > 0;

  // Controlador Global de Controle Remoto Samsung Tizen (D-Pad completo)
  useEffect(() => {
    if (remotePairParam || pinRequest || isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isTypingInSearch = document.activeElement === searchInputRef.current;

      if (isTypingInSearch) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          searchInputRef.current?.blur();
          if (isBackToGroupsVisible) {
            setFocusZone('back_groups_btn');
          } else {
            setFocusZone('list');
            setListFocusIndex(0);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          searchInputRef.current?.blur();
          setFocusZone('header_qr_btn');
        } else if (isTvBackKey(e)) {
          e.preventDefault();
          searchInputRef.current?.blur();
          setFocusZone('list');
        }
        return;
      }

      const keyCode = e.keyCode;

      // 1. Teclas Numéricas (0-9) no controle remoto
      if (keyCode >= TIZEN_KEYS.NUM_0 && keyCode <= TIZEN_KEYS.NUM_9) {
        e.preventDefault();
        const digit = String(keyCode - TIZEN_KEYS.NUM_0);
        setNumericBuffer((prev) => {
          const next = (prev + digit).slice(0, 5);
          if (numericTimerRef.current) window.clearTimeout(numericTimerRef.current);
          numericTimerRef.current = window.setTimeout(() => {
            const chNum = parseInt(next, 10);
            const target = visibleChannelsPool.find((c) => c.number === chNum);
            if (target) {
              handleSelectChannel(target);
            }
            setNumericBuffer('');
          }, 1200);
          return next;
        });
        return;
      }

      // 2. Botões Coloridos do Controle Samsung (ou F1, F2, F3, F4 no Teclado PC)
      if (keyCode === TIZEN_KEYS.RED || e.key === 'F1') {
        e.preventDefault();
        if (selectedChannel) {
          setIsFullScreen((prev) => {
            const next = !prev;
            setFocusZone(next ? 'fullscreen_player' : 'list');
            return next;
          });
        }
        return;
      }
      if (keyCode === TIZEN_KEYS.GREEN || e.key === 'F2') {
        e.preventDefault();
        setIsFullScreen(false);
        setFocusZone('search_input');
        window.setTimeout(() => searchInputRef.current?.focus(), 50);
        return;
      }
      if (keyCode === TIZEN_KEYS.YELLOW || e.key === 'F3') {
        e.preventDefault();
        const focusedEntry = !isShowingGroups ? mixedItemsInView[listFocusIndex] : null;
        const focusedCh =
          focusedEntry && focusedEntry.kind === 'channel' ? focusedEntry.channel : selectedChannel;
        handleToggleFavorite(focusedCh || selectedChannel);
        return;
      }
      if (keyCode === TIZEN_KEYS.BLUE || e.key === 'F4') {
        e.preventDefault();
        setIsModalOpen(true);
        return;
      }

      // 3. CH+ / CH-
      if (keyCode === TIZEN_KEYS.CH_UP || e.key === 'PageUp') {
        e.preventDefault();
        handleChannelStep(1);
        return;
      }
      if (keyCode === TIZEN_KEYS.CH_DOWN || e.key === 'PageDown') {
        e.preventDefault();
        handleChannelStep(-1);
        return;
      }

      // 4. Botão Return / Back da Samsung TV (10009), LG webOS (461) ou Escape
      if (isTvBackKey(e)) {
        e.preventDefault();
        if (isFullScreen) {
          setIsFullScreen(false);
          setFocusZone('list');
          return;
        }
        if (focusZone === 'stage_card') {
          setFocusZone('list');
          return;
        }
        if (!isShowingGroups && activeTab === 'groups' && allChannels.length > 0) {
          handleStepBackHierarchy();
          return;
        }
        if (confirmExitToast) {
          exitTizenApp();
        } else {
          setConfirmExitToast(true);
          window.setTimeout(() => setConfirmExitToast(false), 3000);
        }
        return;
      }

      // 5. Navegação quando está em Tela Cheia
      if (isFullScreen) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleChannelStep(1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleChannelStep(-1);
        } else if (e.key === 'Enter' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setIsFullScreen(false);
          setFocusZone('list');
        }
        return;
      }

      // 5.5 Zona do Botão Central "Continuar Assistindo" (stage_card)
      if (focusZone === 'stage_card') {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (lastWatchedChannel) {
            handleSelectChannel(lastWatchedChannel);
            setFocusZone('list');
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusZone('list');
        }
        return;
      }

      const currentListLength =
        activeTab === 'settings'
          ? 4
          : allChannels.length === 0
          ? 2
          : isShowingGroups
          ? visibleGroupSummaries.length
          : mixedItemsInView.length;

      // 6. Zona do Botão Superior "QR / Lista" (header_qr_btn)
      if (focusZone === 'header_qr_btn') {
        if (e.key === 'Enter') {
          e.preventDefault();
          setIsModalOpen(true);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusZone('search_input');
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusZone('nav_rail');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (selectedChannel) {
            setIsFullScreen(true);
            setFocusZone('fullscreen_player');
          } else if (lastWatchedChannel) {
            setFocusZone('stage_card');
          }
        }
        return;
      }

      // 7. Zona da Barra de Busca (search_input)
      if (focusZone === 'search_input') {
        if (e.key === 'Enter') {
          e.preventDefault();
          searchInputRef.current?.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusZone('header_qr_btn');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (isBackToGroupsVisible) {
            setFocusZone('back_groups_btn');
          } else {
            setFocusZone('list');
            setListFocusIndex(0);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusZone('nav_rail');
        } else if (e.key === 'ArrowRight' && !selectedChannel && lastWatchedChannel) {
          e.preventDefault();
          setFocusZone('stage_card');
        }
        return;
      }

      // 8. Zona do Botão "< Voltar" (back_groups_btn)
      if (focusZone === 'back_groups_btn') {
        if (e.key === 'Enter' || e.key === 'ArrowLeft') {
          e.preventDefault();
          handleStepBackHierarchy();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusZone('search_input');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusZone('list');
          setListFocusIndex(0);
        } else if (e.key === 'ArrowRight' && !selectedChannel && lastWatchedChannel) {
          e.preventDefault();
          setFocusZone('stage_card');
        }
        return;
      }

      // 9. Zona da Barra Lateral Esquerda (nav_rail)
      if (focusZone === 'nav_rail') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIdx = Math.min(NAV_ITEMS.length - 1, navRailIndex + 1);
          setNavRailIndex(nextIdx);
          if (NAV_ITEMS[nextIdx].id !== 'qrcode') {
            handleActivateNavTab(NAV_ITEMS[nextIdx].id, nextIdx);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIdx = Math.max(0, navRailIndex - 1);
          setNavRailIndex(prevIdx);
          if (NAV_ITEMS[prevIdx].id !== 'qrcode') {
            handleActivateNavTab(NAV_ITEMS[prevIdx].id, prevIdx);
          }
        } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault();
          const item = NAV_ITEMS[navRailIndex];
          if (item.id === 'qrcode' && e.key === 'Enter') {
            setIsModalOpen(true);
          } else {
            setFocusZone('list');
            setListFocusIndex(0);
          }
        }
        return;
      }

      // 10. Zona da Lista Principal ou Menu de Configurações (list)
      if (focusZone === 'list') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setListFocusIndex((prev) => Math.min(Math.max(0, currentListLength - 1), prev + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (listFocusIndex === 0) {
            if (isBackToGroupsVisible) {
              setFocusZone('back_groups_btn');
            } else {
              setFocusZone('search_input');
            }
          } else {
            setListFocusIndex((prev) => Math.max(0, prev - 1));
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (!isShowingGroups && activeTab === 'groups' && selectedGroupName) {
            handleStepBackHierarchy();
          } else {
            setFocusZone('nav_rail');
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (selectedChannel) {
            setIsFullScreen(true);
            setFocusZone('fullscreen_player');
          } else if (lastWatchedChannel) {
            // Move o foco para o botão "Continuar Assistindo" no centro da tela!
            setFocusZone('stage_card');
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (activeTab === 'settings') {
            if (listFocusIndex === 0) {
              handleRequestToggleAdultContent();
            } else if (listFocusIndex === 1) {
              handleOpenChangePinKeypad();
            } else if (listFocusIndex === 2) {
              handleSwitchEngineMode();
            } else if (listFocusIndex === 3) {
              setIsModalOpen(true);
            }
            return;
          }

          if (allChannels.length === 0) {
            if (listFocusIndex === 0) {
              setIsModalOpen(true);
            } else {
              handleLoadDemo();
            }
            return;
          }

          if (isShowingGroups) {
            const grp = visibleGroupSummaries[listFocusIndex];
            if (grp) handleSelectGroup(grp);
          } else {
            const item = mixedItemsInView[listFocusIndex];
            if (!item) return;
            if (item.kind === 'folder') {
              handleSelectFolder(item.folder);
            } else {
              handleSelectChannel(item.channel);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    remotePairParam,
    pinRequest,
    isModalOpen,
    isFullScreen,
    isShowingGroups,
    isBackToGroupsVisible,
    activeTab,
    selectedGroupName,
    focusZone,
    navRailIndex,
    listFocusIndex,
    visibleGroupSummaries,
    mixedItemsInView,
    visibleChannelsPool,
    allChannels.length,
    selectedChannel,
    lastWatchedChannel,
    confirmExitToast,
    handleChannelStep,
    handleStepBackHierarchy,
    handleSelectGroup,
    handleSelectFolder,
    handleSelectChannel,
    handleToggleFavorite,
    handleActivateNavTab,
    handleLoadDemo,
    handleRequestToggleAdultContent,
    handleOpenChangePinKeypad,
    handleSwitchEngineMode,
  ]);

  if (remotePairParam) {
    return (
      <MobileRemoteSetup
        initialPairCode={remotePairParam}
        onExitRemoteMode={() => {
          window.history.replaceState({}, '', window.location.pathname);
          setRemotePairParam(null);
        }}
      />
    );
  }

  const engineLabel =
    engineMode === 'auto'
      ? 'Automático (Híbrido)'
      : engineMode === 'tizen_avplay'
      ? 'Samsung AVPlay (Hardware)'
      : 'HLS.js + HTML5';

  return (
    <div className={`tizen-app-shell ${isFullScreen ? 'mode-fullscreen' : 'mode-split'}`}>
      {!isFullScreen && (
        <aside className="tizen-sidebar-panel">
          <nav className="tizen-nav-rail">
            <div className="brand-logo-mini" title="TVPlayer Smart TV">
              <img
                src="./icon.png"
                alt="TVPlayer"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }}
              />
            </div>

            <div className="nav-rail-items">
              {NAV_ITEMS.map((item, idx) => {
                const isSelected = activeTab === item.id;
                const isDpadFocused = focusZone === 'nav_rail' && navRailIndex === idx;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-rail-btn ${isSelected ? 'active' : ''} ${
                      isDpadFocused ? 'dpad-focused' : ''
                    }`}
                    onClick={() => handleActivateNavTab(item.id, idx)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {m3uUrl && (
              <button
                type="button"
                className="nav-rail-btn reload-btn"
                onClick={() => handleLoadM3uFromUrl(m3uUrl)}
                title="Atualizar Lista M3U da Internet"
              >
                <RefreshCw size={18} />
                <span>Atualizar</span>
              </button>
            )}
          </nav>

          <div className="tizen-channel-drawer">
            <div className="drawer-top-header">
              {/* Barra de Localização / Guia Contextual do Controle Remoto */}
              <div className="ux-context-banner">
                <div className="ux-context-where">
                  <Compass size={14} />
                  <span>{focusContextInfo.where}</span>
                </div>
                <span className="ux-context-hint">{focusContextInfo.hint}</span>
              </div>

              <div className="drawer-brand-row">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h1>TVPlayer</h1>
                    {showAdultContent && (
                      <span
                        className="badge-18plus active"
                        title="Selo +18 Ativo: Canais adultos visíveis na lista"
                      >
                        +18
                      </span>
                    )}
                  </div>
                  <span className="subtitle-pill">
                    {allChannels.length > 0
                      ? `${visibleChannelsPool.length.toLocaleString('pt-BR')} itens visíveis`
                      : `Aguardando Lista • Cód: ${pairingCode}`}
                  </span>
                </div>
                <button
                  type="button"
                  className={`load-url-trigger-btn ${
                    focusZone === 'header_qr_btn' ? 'dpad-focused' : ''
                  }`}
                  onClick={() => setIsModalOpen(true)}
                >
                  <QrCode size={15} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                  QR / Lista
                </button>
              </div>

              <div
                className={`tv-search-box ${
                  focusZone === 'search_input' ? 'dpad-focused' : ''
                }`}
                onClick={() => {
                  setFocusZone('search_input');
                  searchInputRef.current?.focus();
                }}
              >
                <Search size={18} className="search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar canal, série ou categoria (OK p/ digitar)..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onFocus={() => setFocusZone('search_input')}
                />
                {searchText && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchText('');
                      setDebouncedSearch('');
                    }}
                  >
                    Limpar
                  </button>
                )}
              </div>

              {isBackToGroupsVisible && (
                <button
                  type="button"
                  className={`back-to-groups-btn ${
                    focusZone === 'back_groups_btn' ? 'dpad-focused' : ''
                  }`}
                  onClick={handleStepBackHierarchy}
                >
                  <ArrowLeft size={16} /> {backButtonLabel}
                </button>
              )}

              <div className="drawer-section-title">
                <span>{headerTitle}</span>
                {!isShowingGroups && activeTab !== 'settings' && allChannels.length > 0 && (
                  <span className="hint-small">2x OK = Tela Cheia</span>
                )}
              </div>
            </div>

            <div className="drawer-list-body">
              {activeTab === 'settings' ? (
                <div className="sidebar-settings-menu">
                  {settingsFeedback && (
                    <div className="settings-feedback-banner">{settingsFeedback}</div>
                  )}

                  <button
                    type="button"
                    className={`tv-list-item settings-option-card ${
                      focusZone === 'list' && listFocusIndex === 0 ? 'dpad-focused' : ''
                    }`}
                    onMouseEnter={() => {
                      setFocusZone('list');
                      setListFocusIndex(0);
                    }}
                    onClick={handleRequestToggleAdultContent}
                  >
                    <div
                      className={`item-icon-box ${
                        showAdultContent ? 'locked-icon' : 'group-icon'
                      }`}
                    >
                      {showAdultContent ? <Eye size={20} /> : <EyeOff size={20} />}
                    </div>
                    <div className="item-text-col">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="item-title">Selo +18 (Canais Adultos)</span>
                        <span className={`badge-18plus ${showAdultContent ? 'active' : 'off'}`}>
                          {showAdultContent ? '+18 VISÍVEL' : 'OCULTO'}
                        </span>
                      </div>
                      <span className="item-subtitle">
                        {showAdultContent
                          ? 'Visível na lista (pede senha ao abrir). Aperte OK p/ ocultar.'
                          : 'Canais +18 ocultos da lista. Aperte OK + Senha para mostrar.'}
                      </span>
                    </div>
                    {focusZone === 'list' && listFocusIndex === 0 && (
                      <span className="dpad-ok-pill">
                        {showAdultContent ? 'Ocultar' : '🔒 Ativar'}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`tv-list-item settings-option-card ${
                      focusZone === 'list' && listFocusIndex === 1 ? 'dpad-focused' : ''
                    }`}
                    onMouseEnter={() => {
                      setFocusZone('list');
                      setListFocusIndex(1);
                    }}
                    onClick={handleOpenChangePinKeypad}
                  >
                    <div className="item-icon-box group-icon">
                      <KeyRound size={20} />
                    </div>
                    <div className="item-text-col">
                      <span className="item-title">Atualizar Senha Parental</span>
                      <span className="item-subtitle">
                        Alterar senha de 4 dígitos pelo controle (Padrão: 0000)
                      </span>
                    </div>
                    {focusZone === 'list' && listFocusIndex === 1 && (
                      <span className="dpad-ok-pill">OK ➔</span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`tv-list-item settings-option-card ${
                      focusZone === 'list' && listFocusIndex === 2 ? 'dpad-focused' : ''
                    }`}
                    onMouseEnter={() => {
                      setFocusZone('list');
                      setListFocusIndex(2);
                    }}
                    onClick={handleSwitchEngineMode}
                  >
                    <div className="item-icon-box">
                      <Cpu size={20} />
                    </div>
                    <div className="item-text-col">
                      <span className="item-title">Motor de Vídeo: {engineLabel}</span>
                      <span className="item-subtitle">
                        Aperte OK para alternar (Auto / AVPlay / HLS)
                      </span>
                    </div>
                    {focusZone === 'list' && listFocusIndex === 2 && (
                      <span className="dpad-ok-pill">Alternar</span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`tv-list-item settings-option-card ${
                      focusZone === 'list' && listFocusIndex === 3 ? 'dpad-focused' : ''
                    }`}
                    onMouseEnter={() => {
                      setFocusZone('list');
                      setListFocusIndex(3);
                    }}
                    onClick={() => setIsModalOpen(true)}
                  >
                    <div className="item-icon-box">
                      <QrCode size={20} />
                    </div>
                    <div className="item-text-col">
                      <span className="item-title">Gerenciar Lista IPTV / QR Code</span>
                      <span className="item-subtitle">
                        Enviar nova lista pelo celular, link M3U ou Xtream
                      </span>
                    </div>
                    {focusZone === 'list' && listFocusIndex === 3 && (
                      <span className="dpad-ok-pill">Abrir ➔</span>
                    )}
                  </button>

                  <div className="settings-security-note">
                    <Lock size={15} />
                    <span>
                      <strong>Proteção Dupla Ativa:</strong> Mesmo após ativar o selo{' '}
                      <code>+18</code> para exibir as categorias na lista, abrir qualquer categoria
                      ou canal adulto continua exigindo a confirmação da Senha Parental.
                    </span>
                  </div>
                </div>
              ) : allChannels.length === 0 ? (
                <div className="sidebar-onboarding-menu">
                  <p className="sidebar-onboarding-text">
                    Nenhuma lista IPTV foi configurada ainda. Escolha como deseja começar usando as{' '}
                    <strong>Setas ▲ ▼</strong> e <strong>OK</strong>:
                  </p>

                  <button
                    type="button"
                    className={`tv-list-item onboarding-option-btn ${
                      focusZone === 'list' && listFocusIndex === 0 ? 'dpad-focused' : ''
                    }`}
                    onClick={() => setIsModalOpen(true)}
                  >
                    <div className="item-icon-box group-icon">
                      <QrCode size={20} />
                    </div>
                    <div className="item-text-col">
                      <span className="item-title">Enviar Lista pelo Celular / URL</span>
                      <span className="item-subtitle">QR Code, Link M3U ou Xtream Codes</span>
                    </div>
                    {focusZone === 'list' && listFocusIndex === 0 && (
                      <span className="dpad-ok-pill">OK ➔</span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`tv-list-item onboarding-option-btn ${
                      focusZone === 'list' && listFocusIndex === 1 ? 'dpad-focused' : ''
                    }`}
                    onClick={handleLoadDemo}
                  >
                    <div className="item-icon-box">
                      <Sparkles size={20} />
                    </div>
                    <div className="item-text-col">
                      <span className="item-title">Testar Canais de Demonstração</span>
                      <span className="item-subtitle">Carregar canais abertos para teste</span>
                    </div>
                    {focusZone === 'list' && listFocusIndex === 1 && (
                      <span className="dpad-ok-pill">OK ➔</span>
                    )}
                  </button>
                </div>
              ) : isShowingGroups ? (
                <VirtualGroupList
                  groups={visibleGroupSummaries}
                  focusedIndex={listFocusIndex}
                  isZoneActive={focusZone === 'list'}
                  onFocusIndex={(i) => {
                    setFocusZone('list');
                    setListFocusIndex(i);
                  }}
                  onSelectGroup={(grp) => handleSelectGroup(grp)}
                />
              ) : mixedItemsInView.length > 0 ? (
                <VirtualMixedList
                  items={mixedItemsInView}
                  activeChannelUrl={selectedChannel?.url}
                  favoriteUrls={favoriteSet}
                  focusedIndex={listFocusIndex}
                  isZoneActive={focusZone === 'list'}
                  onFocusIndex={(i) => {
                    setFocusZone('list');
                    setListFocusIndex(i);
                  }}
                  onSelectFolder={(folder) => handleSelectFolder(folder)}
                  onSelectChannel={(ch) => handleSelectChannel(ch)}
                />
              ) : (
                <div className="empty-list-message">
                  <p>Nenhum canal ou série encontrado nesta pasta ou filtro.</p>
                </div>
              )}
            </div>

            <div className="drawer-remote-footer">
              <span onClick={() => selectedChannel && setIsFullScreen(true)}>
                <i className="color-dot red" /> Tela Cheia
              </span>
              <span onClick={() => searchInputRef.current?.focus()}>
                <i className="color-dot green" /> Buscar
              </span>
              <span
                onClick={() => {
                  const focusedEntry = !isShowingGroups ? mixedItemsInView[listFocusIndex] : null;
                  const target =
                    focusedEntry && focusedEntry.kind === 'channel'
                      ? focusedEntry.channel
                      : selectedChannel;
                  handleToggleFavorite(target || selectedChannel);
                }}
              >
                <i className="color-dot yellow" /> Favorito
              </span>
              <span onClick={() => setIsModalOpen(true)}>
                <i className="color-dot blue" /> QR / Lista
              </span>
            </div>
          </div>
        </aside>
      )}

      <main className="tizen-player-stage">
        {!isFullScreen && selectedChannel && (
          <button
            type="button"
            className="floating-fullscreen-btn"
            onClick={() => {
              setIsFullScreen(true);
              setFocusZone('fullscreen_player');
            }}
            title="Expandir Vídeo em Tela Cheia (Botão Vermelho / F1)"
          >
            <Maximize2 size={18} />
          </button>
        )}

        <VideoPlayer
          channel={selectedChannel}
          totalChannelsCount={visibleChannelsPool.length}
          totalGroupsCount={visibleGroupSummaries.length}
          pairingCode={pairingCode}
          lastWatchedChannel={lastWatchedChannel}
          isStageFocused={focusZone === 'stage_card'}
          isFullScreen={isFullScreen}
          isFavorite={Boolean(selectedChannel && favoriteSet.has(selectedChannel.url))}
          engineMode={engineMode}
          numericBuffer={numericBuffer}
          onToggleFullScreen={() => {
            if (!selectedChannel) return;
            setIsFullScreen((prev) => {
              const next = !prev;
              setFocusZone(next ? 'fullscreen_player' : 'list');
              return next;
            });
          }}
          onToggleFavorite={() => handleToggleFavorite(selectedChannel)}
          onChannelStep={handleChannelStep}
          onSwitchEngine={handleSwitchEngineMode}
          onOpenSettingsModal={() => setIsModalOpen(true)}
          onLoadDemoChannels={handleLoadDemo}
          onSelectLastChannel={(ch) => handleSelectChannel(ch)}
        />
      </main>

      {isLoading && (
        <div className="tizen-loading-overlay">
          <div className="loading-card">
            <div className="tv-spinner large" />
            <h3>Sincronizando Lista IPTV</h3>
            <p>{loadingStatus}</p>
          </div>
        </div>
      )}

      {confirmExitToast && (
        <div className="tizen-exit-toast">
          Pressione <strong>RETURN / VOLTAR</strong> novamente para sair do aplicativo.
        </div>
      )}

      <PlaylistModal
        isOpen={isModalOpen}
        pairingCode={pairingCode}
        m3uUrl={m3uUrl}
        xtreamCreds={xtreamCreds}
        engineMode={engineMode}
        showAdultContent={showAdultContent}
        isLoading={isLoading}
        onClose={() => setIsModalOpen(false)}
        onLoadM3uUrl={handleLoadM3uFromUrl}
        onLoadRawContent={handleLoadRawContent}
        onLoadDemo={handleLoadDemo}
        onChangeEngineMode={(mode) => {
          setEngineMode(mode);
          storageService.setPlayerEngine(mode);
        }}
        onRequestToggleAdultContent={handleRequestToggleAdultContent}
        onRequestChangePinKeypad={handleOpenChangePinKeypad}
      />

      <ParentalPinModal
        isOpen={Boolean(pinRequest)}
        mode={pinRequest?.mode || 'verify'}
        targetTitle={pinRequest?.title || 'Conteúdo Restrito'}
        onSuccess={() => pinRequest?.onVerified()}
        onCancel={() => setPinRequest(null)}
      />
    </div>
  );
}

/**
 * Organiza automaticamente canais com estrutura de Série (S01E01, T01E01, 1x01, Cap.) em Pastas
 * e mantém canais normais/filmes avulsos logo abaixo.
 */
function buildMixedFolderAndChannelItems(channels: Channel[]): MixedBrowserItem[] {
  const seriesMap = new Map<
    string,
    { count: number; seasons: Set<number>; logo?: string }
  >();
  const standaloneChannels: Channel[] = [];

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    if (ch.seriesName) {
      let entry = seriesMap.get(ch.seriesName);
      if (!entry) {
        entry = { count: 0, seasons: new Set<number>(), logo: ch.logo };
        seriesMap.set(ch.seriesName, entry);
      }
      entry.count++;
      entry.seasons.add(ch.seasonNumber || 1);
      if (!entry.logo && ch.logo) {
        entry.logo = ch.logo;
      }
    } else {
      standaloneChannels.push(ch);
    }
  }

  const folderItems: MixedBrowserItem[] = Array.from(seriesMap.entries())
    .sort((a, b) => ptCollator.compare(a[0], b[0]))
    .map(([seriesName, info]) => {
      const seasonCount = info.seasons.size;
      const seasonLabel =
        seasonCount > 1 ? `${seasonCount} temporadas • ` : '1 temporada • ';
      return {
        kind: 'folder',
        folder: {
          type: 'series_folder',
          name: seriesName,
          subtitle: `${seasonLabel}${info.count} episódios`,
          count: info.count,
          logo: info.logo,
        },
      };
    });

  const channelItems: MixedBrowserItem[] = standaloneChannels.map((channel) => ({
    kind: 'channel',
    channel,
  }));

  return [...folderItems, ...channelItems];
}

export default App;
