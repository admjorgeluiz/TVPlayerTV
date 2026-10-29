import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckCircle2,
  Cpu,
  DownloadCloud,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Lock,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { PlayerEngineMode, XtreamCredentials } from '../types/iptv';
import { buildXtreamM3uUrl } from '../services/m3uParser';
import { getDeviceInfo, isTvBackKey, TIZEN_KEYS } from '../services/tizenBridge';
import { detectLanServerBaseUrl } from '../services/pairingService';
import { DEFAULT_PARENTAL_PIN, storageService } from '../services/storageService';

interface PlaylistModalProps {
  isOpen: boolean;
  pairingCode: string;
  m3uUrl: string;
  xtreamCreds: XtreamCredentials;
  engineMode: PlayerEngineMode;
  showAdultContent: boolean;
  isLoading: boolean;
  onClose: () => void;
  onLoadM3uUrl: (url: string, savedCreds?: XtreamCredentials) => void;
  onLoadRawContent: (content: string) => void;
  onLoadDemo: () => void;
  onChangeEngineMode: (mode: PlayerEngineMode) => void;
  onRequestToggleAdultContent: () => void;
  onRequestChangePinKeypad: () => void;
}

type ModalTabId = 'qrcode' | 'url' | 'xtream' | 'parental' | 'system';
const MODAL_TABS: ModalTabId[] = ['qrcode', 'url', 'xtream', 'parental', 'system'];

export const PlaylistModal: React.FC<PlaylistModalProps> = ({
  isOpen,
  pairingCode,
  m3uUrl,
  xtreamCreds,
  engineMode,
  showAdultContent,
  isLoading,
  onClose,
  onLoadM3uUrl,
  onLoadDemo,
  onChangeEngineMode,
  onRequestToggleAdultContent,
  onRequestChangePinKeypad,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTabId>('qrcode');
  const [urlInput, setUrlInput] = useState(m3uUrl);
  const [serverUrl, setServerUrl] = useState(xtreamCreds.serverUrl || 'http://');
  const [username, setUsername] = useState(xtreamCreds.username);
  const [password, setPassword] = useState(xtreamCreds.password);
  const [lanBaseUrl, setLanBaseUrl] = useState('https://admjorgeluiz.github.io/tv');

  // Estados de Alteração do PIN Parental
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [pinFeedback, setPinFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setUrlInput(m3uUrl);
  }, [m3uUrl]);

  useEffect(() => {
    if (isOpen) {
      detectLanServerBaseUrl().then((url) => setLanBaseUrl(url));
      setCurrentPinInput('');
      setNewPinInput('');
      setPinFeedback(null);
    }
  }, [isOpen]);

  // Permite trocar as abas do Modal usando as Setas Esquerda / Direita do Controle Remoto Samsung!
  useEffect(() => {
    if (!isOpen) return;

    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (isTvBackKey(e)) {
        e.preventDefault();
        onClose();
        return;
      }

      const tag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea';
      if (isTyping) return;

      const idx = MODAL_TABS.indexOf(activeTab);
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveTab(MODAL_TABS[(idx + 1) % MODAL_TABS.length]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveTab(MODAL_TABS[(idx - 1 + MODAL_TABS.length) % MODAL_TABS.length]);
      } else if (activeTab === 'parental' && e.key === 'Enter') {
        e.preventDefault();
        onRequestToggleAdultContent();
      }
    };

    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isOpen, activeTab, onClose, onRequestToggleAdultContent]);

  if (!isOpen) return null;

  const deviceInfo = getDeviceInfo();
  const qrTargetUrl = `${lanBaseUrl}/?pair=${encodeURIComponent(pairingCode)}`;

  const handleSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    onLoadM3uUrl(urlInput.trim());
  };

  const handleSubmitXtream = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim() || !username.trim() || !password.trim()) return;
    const creds: XtreamCredentials = {
      serverUrl: serverUrl.trim(),
      username: username.trim(),
      password: password.trim(),
    };
    const generatedUrl = buildXtreamM3uUrl(creds);
    setUrlInput(generatedUrl);
    onLoadM3uUrl(generatedUrl, creds);
  };

  const handleChangeParentalPin = (e: React.FormEvent) => {
    e.preventDefault();
    const savedPin = storageService.getParentalPin();
    if (currentPinInput.trim() !== savedPin) {
      setPinFeedback({
        type: 'err',
        text: `Senha atual incorreta! (A senha padrão de fábrica é ${DEFAULT_PARENTAL_PIN})`,
      });
      return;
    }
    if (newPinInput.trim().length < 4 || !/^\d+$/.test(newPinInput.trim())) {
      setPinFeedback({
        type: 'err',
        text: 'A nova senha deve conter pelo menos 4 dígitos numéricos.',
      });
      return;
    }
    storageService.setParentalPin(newPinInput.trim());
    setCurrentPinInput('');
    setNewPinInput('');
    setPinFeedback({
      type: 'ok',
      text: '✅ Senha de Controle Parental atualizada com sucesso!',
    });
  };

  return (
    <div className="tv-modal-backdrop" onClick={onClose}>
      <div className="tv-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="tv-modal-header">
          <div className="modal-title-group">
            <img
              src="./icon.png"
              alt="TVPlayer"
              style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: '#ffffff', objectFit: 'contain' }}
            />
            <div>
              <h2>Configurações, QR Code &amp; Controle Parental (+18)</h2>
              <p>
                Use as setas <strong>◄ ►</strong> do controle para alternar entre as abas abaixo
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <div className="tv-modal-tabs">
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'qrcode' ? 'active' : ''}`}
            onClick={() => setActiveTab('qrcode')}
          >
            <QrCode size={18} /> QR Code (Celular/PC)
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'url' ? 'active' : ''}`}
            onClick={() => setActiveTab('url')}
          >
            <Link2 size={18} /> URL M3U
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'xtream' ? 'active' : ''}`}
            onClick={() => setActiveTab('xtream')}
          >
            <KeyRound size={18} /> Xtream Codes
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'parental' ? 'active' : ''}`}
            onClick={() => setActiveTab('parental')}
          >
            <Lock size={18} /> Controle Parental (+18)
          </button>
          <button
            type="button"
            className={`modal-tab-btn ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <Cpu size={18} /> Hardware TV
          </button>
        </div>

        <div className="tv-modal-body">
          {activeTab === 'qrcode' && (
            <div className="qr-pairing-container">
              <div className="qr-box-column">
                <div className="qr-white-frame">
                  <QRCodeSVG
                    value={qrTargetUrl}
                    size={200}
                    level="M"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#0b0f17"
                  />
                </div>
                <span className="qr-code-badge">CÓDIGO: {pairingCode}</span>
              </div>

              <div className="qr-instructions-column">
                <div className="qr-live-status">
                  <span className="pulse-dot" />
                  <span>Aguardando envio pelo Celular ou PC em tempo real...</span>
                </div>

                <h3>Envie sua lista em 3 passos simples:</h3>

                <ol className="qr-steps-list">
                  <li>
                    <strong>1. Escaneie o QR Code ao lado</strong> com a câmera do seu celular
                    (conectado no mesmo Wi-Fi) ou abra no navegador:
                    <div className="qr-url-highlight">
                      <Smartphone size={16} />
                      <span>{qrTargetUrl}</span>
                    </div>
                  </li>
                  <li>
                    <strong>2. Cole o link .M3U, Xtream Codes ou Arquivo</strong> direto na página
                    que abrirá no seu celular/PC.
                  </li>
                  <li>
                    <strong>3. Toque em &ldquo;Enviar Lista para a TV&rdquo;</strong> — esta tela
                    fechará sozinha e todos os canais serão carregados na hora!
                  </li>
                </ol>

                <div className="modal-actions-row">
                  <button type="button" className="tv-btn secondary" onClick={onLoadDemo}>
                    <Sparkles size={18} /> Carregar Canais Demo
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'url' && (
            <form onSubmit={handleSubmitUrl} className="modal-form">
              <label className="tv-field-label">URL da Lista (.m3u ou .m3u8)</label>
              <input
                type="url"
                className="tv-input"
                placeholder="https://exemplo.com/get.php?username=...&type=m3u_plus"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <p className="field-hint">
                A URL fica salva automaticamente na memória da sua Samsung TV.
              </p>

              <div className="modal-actions-row">
                <button
                  type="submit"
                  className="tv-btn primary"
                  disabled={isLoading || !urlInput.trim()}
                >
                  <DownloadCloud size={20} /> Carregar Lista M3U
                </button>
                <button type="button" className="tv-btn secondary" onClick={onLoadDemo}>
                  <Sparkles size={20} /> Carregar Canais Demo
                </button>
              </div>
            </form>
          )}

          {activeTab === 'xtream' && (
            <form onSubmit={handleSubmitXtream} className="modal-form">
              <div className="form-grid-2">
                <div className="full-width">
                  <label className="tv-field-label">URL do Servidor (DNS:Porta)</label>
                  <input
                    type="text"
                    className="tv-input"
                    placeholder="http://servidor.exemplo.com:80"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                  />
                </div>
                <div>
                  <label className="tv-field-label">Usuário</label>
                  <input
                    type="text"
                    className="tv-input"
                    placeholder="Seu usuário"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label className="tv-field-label">Senha</label>
                  <input
                    type="password"
                    className="tv-input"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions-row">
                <button type="submit" className="tv-btn primary" disabled={isLoading}>
                  <CheckCircle2 size={20} /> Conectar e Gerar Lista M3U Plus
                </button>
              </div>
            </form>
          )}

          {activeTab === 'parental' && (
            <div className="modal-form">
              {/* Card de Ativação do Selo +18 */}
              <div className="adult-visibility-card">
                <div className="adult-visibility-info">
                  <div className="adult-visibility-title-row">
                    <span className={`badge-18plus ${showAdultContent ? 'active' : 'off'}`}>
                      +18
                    </span>
                    <strong>Exibir Categorias e Canais +18 na Lista</strong>
                  </div>
                  <p className="field-hint">
                    Por padrão, os canais adultos ficam <strong>totalmente ocultos</strong> da
                    lista. Ao ativar o selo <code>+18</code> (mediante senha), eles passam a
                    aparecer na lista, mas ainda exigem a senha parental para abrir/reproduzir.
                  </p>
                </div>
                <button
                  type="button"
                  className={`tv-btn ${showAdultContent ? 'secondary' : 'primary'}`}
                  onClick={onRequestToggleAdultContent}
                >
                  {showAdultContent ? (
                    <>
                      <EyeOff size={18} /> Ocultar Canais +18 Agora
                    </>
                  ) : (
                    <>
                      <Eye size={18} /> Ativar Selo +18 (Pedir Senha)
                    </>
                  )}
                </button>
              </div>

              <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '6px 0' }} />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <strong style={{ fontSize: 14 }}>Alterar Senha Parental pelo Controle Remoto</strong>
                  <p className="field-hint">
                    Use o teclado virtual na TV (Setas + OK) ou preencha os campos abaixo. Senha
                    padrão: <strong>0000</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  className="tv-btn primary"
                  onClick={onRequestChangePinKeypad}
                >
                  <ShieldCheck size={18} /> Trocar Senha via Controle (Setas)
                </button>
              </div>

              {pinFeedback && (
                <div
                  className={
                    pinFeedback.type === 'ok' ? 'mobile-success-box' : 'mobile-error-box'
                  }
                >
                  {pinFeedback.text}
                </div>
              )}

              <form onSubmit={handleChangeParentalPin} className="form-grid-2">
                <div>
                  <label className="tv-field-label">Senha Atual (Padrão: 0000)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    className="tv-input"
                    placeholder="Digite a senha atual"
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                  />
                </div>
                <div>
                  <label className="tv-field-label">Nova Senha (Mínimo 4 números)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    className="tv-input"
                    placeholder="Nova senha numérica"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                  />
                </div>
                <div className="full-width">
                  <button type="submit" className="tv-btn secondary">
                    <Lock size={16} /> Salvar Nova Senha Digitada
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="system-info-panel">
              <div className="engine-selector-box">
                <label className="tv-field-label">Motor de Decodificação de Vídeo</label>
                <div className="engine-options">
                  <button
                    type="button"
                    className={`engine-opt-btn ${engineMode === 'auto' ? 'selected' : ''}`}
                    onClick={() => onChangeEngineMode('auto')}
                  >
                    <strong>Automático (Híbrido)</strong>
                    <span>Usa HLS.js para .m3u8 e AVPlay para streams .ts pesados</span>
                  </button>
                  <button
                    type="button"
                    className={`engine-opt-btn ${engineMode === 'html5_hls' ? 'selected' : ''}`}
                    onClick={() => onChangeEngineMode('html5_hls')}
                  >
                    <strong>HLS.js + HTML5 MSE</strong>
                    <span>Troca de canal ultra rápida com suporte a overlays modernos</span>
                  </button>
                  <button
                    type="button"
                    className={`engine-opt-btn ${engineMode === 'tizen_avplay' ? 'selected' : ''}`}
                    onClick={() => onChangeEngineMode('tizen_avplay')}
                  >
                    <strong>Samsung AVPlay Nativo</strong>
                    <span>Decodificador de hardware direto da Samsung TV (HEVC/AC3)</span>
                  </button>
                </div>
              </div>

              <div className="device-specs-grid">
                <div className="spec-card">
                  <span className="spec-label">Plataforma</span>
                  <strong>{deviceInfo.platform}</strong>
                </div>
                <div className="spec-card">
                  <span className="spec-label">Modelo da TV</span>
                  <strong>{deviceInfo.model}</strong>
                </div>
                <div className="spec-card">
                  <span className="spec-label">Versão Tizen</span>
                  <strong>{deviceInfo.tizenVersion}</strong>
                </div>
                <div className="spec-card">
                  <span className="spec-label">DUID (Certificado Samsung)</span>
                  <strong className="mono">{deviceInfo.duid}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
