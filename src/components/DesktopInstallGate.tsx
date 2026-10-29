import React, { useEffect, useState } from 'react';
import { Download, Monitor, Sparkles, ArrowRight, Laptop, CheckCircle2 } from 'lucide-react';
import { isSmartTV, isInstalledPWA } from '../services/tizenBridge';

interface DesktopInstallGateProps {
  children: React.ReactNode;
}

export const DesktopInstallGate: React.FC<DesktopInstallGateProps> = ({ children }) => {
  const [isTV, setIsTV] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [bypassed, setBypassed] = useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem('tvplayer_desktop_bypass') === 'true' ||
        window.location.search.includes('bypass=true') ||
        window.location.search.includes('preview=true')
      );
    } catch {
      return false;
    }
  });
  const [showManualGuide, setShowManualGuide] = useState(false);

  useEffect(() => {
    const tvDetected = isSmartTV();
    setIsTV(tvDetected);

    if (tvDetected) return;

    // Verificar se já está em modo standalone
    const standalone = isInstalledPWA();
    setIsStandalone(standalone);

    // Ouvir alterações de display-mode
    try {
      const matchMediaStandalone = window.matchMedia('(display-mode: standalone)');
      const handleMediaChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          setIsStandalone(true);
        }
      };
      matchMediaStandalone.addEventListener?.('change', handleMediaChange);

      // Capturar evento PWA nativo
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      const handleAppInstalled = () => {
        setIsStandalone(true);
        setDeferredPrompt(null);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstall);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        matchMediaStandalone.removeEventListener?.('change', handleMediaChange);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    } catch (err) {
      console.warn('[DesktopInstallGate] Listeners PWA:', err);
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsStandalone(true);
        } else {
          setShowManualGuide(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('[DesktopInstallGate] Prompt:', err);
        setShowManualGuide(true);
      }
    } else {
      setShowManualGuide(true);
    }
  };

  const handleBypass = () => {
    try {
      sessionStorage.setItem('tvplayer_desktop_bypass', 'true');
    } catch {}
    setBypassed(true);
  };

  const handleVerify = () => {
    if (isInstalledPWA()) {
      setIsStandalone(true);
    } else {
      setShowManualGuide(true);
    }
  };

  // Se for TV, PWA Standalone ou liberado pelo usuário, renderiza o App
  if (isTV || isStandalone || bypassed) {
    return <>{children}</>;
  }

  const currentHost = typeof window !== 'undefined' ? window.location.host : 'localhost:5173';

  const isNotLocalhost =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    window.location.protocol !== 'https:';

  return (
    <div className="desktop-gate-backdrop">
      <div className="desktop-gate-card">
        {/* Header com Logo e Badge */}
        <div className="desktop-gate-header">
          <div className="desktop-gate-logo-wrapper">
            <img
              src="./icon.png"
              alt="TVPlayer"
              className="desktop-gate-logo-img"
            />
          </div>
          <div className="desktop-gate-badge">
            <Sparkles size={12} />
            <span>Versão Desktop Híbrida</span>
          </div>
        </div>

        <h1 className="desktop-gate-title">Instalação Necessária para Continuar</h1>
        <p className="desktop-gate-subtitle">
          Para garantir máxima aceleração por hardware, interface em tela cheia e a mesma estabilidade
          das Smart TVs, instale o <strong>TVPlayer</strong> no seu computador.
        </p>

        {/* Benefícios Rápidos */}
        <div className="desktop-gate-features">
          <div className="desktop-gate-feat-item">
            <Monitor size={18} className="feat-icon" />
            <div>
              <strong>Janela Dedicada Sem Bordas</strong>
              <p>Execute como aplicativo nativo com tela cheia.</p>
            </div>
          </div>
          <div className="desktop-gate-feat-item">
            <Laptop size={18} className="feat-icon" />
            <div>
              <strong>Alto Desempenho</strong>
              <p>Reprodução otimizada sem limitações de navegador.</p>
            </div>
          </div>
        </div>

        {/* Aviso se estiver acessando via IP da rede ao invés de localhost */}
        {isNotLocalhost && (
          <div className="desktop-gate-ip-notice">
            <span>💡 <strong>Atenção:</strong> O Chrome/Edge só libera o botão de instalação em <strong>http://localhost:5173/</strong> ou via HTTPS. Acesse via localhost para instalar!</span>
          </div>
        )}

        {/* Guia Visual da Barra de Endereços */}
        {showManualGuide && (
          <div className="desktop-gate-guide-box">
            <div className="desktop-gate-browser-mock">
              <div className="mock-dots">
                <span className="dot dot-red"></span>
                <span className="dot dot-yellow"></span>
                <span className="dot dot-green"></span>
              </div>
              <div className="mock-url-bar">
                <span className="mock-lock">🔒</span>
                <span className="mock-url">{currentHost}</span>
                <div className="mock-install-target">
                  <Monitor size={13} />
                  <span>Instalar</span>
                </div>
              </div>
            </div>
            <p className="desktop-gate-guide-text">
              1. <strong>Barra de endereços:</strong> clique no ícone <strong>🖥️ Instalar</strong> à direita da URL.<br />
              2. <strong>Ou pelo menu:</strong> clique nos <strong>3 pontinhos (⋮)</strong> do navegador &gt; <strong>&quot;Salvar e compartilhar&quot;</strong> &gt; <strong>&quot;Instalar TVPlayer...&quot;</strong>
            </p>
          </div>
        )}

        {/* Ações */}
        <div className="desktop-gate-actions">
          <button
            type="button"
            className="desktop-gate-btn-primary"
            onClick={handleInstallClick}
          >
            <Download size={18} />
            <span>Instalar TVPlayer no Computador</span>
          </button>

          <button
            type="button"
            className="desktop-gate-btn-secondary"
            onClick={handleBypass}
          >
            <span>Continuar no Navegador</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Rodapé com verificação */}
        <div className="desktop-gate-footer">
          <button
            type="button"
            className="desktop-gate-verify-btn"
            onClick={handleVerify}
          >
            <CheckCircle2 size={13} />
            <span>Já instalou? Clique aqui para abrir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
