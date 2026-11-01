import React, { useEffect, useState } from 'react';
import { Download, CheckCircle2, AlertCircle, Sparkles, X, ArrowUpRight } from 'lucide-react';
import { UpdateInfo, UpdateProgress } from '../services/updateService';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: UpdateInfo | null;
  isChecking?: boolean;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  updateInfo,
  isChecking = false,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setDownloading(false);
      setProgress(null);
      setError(null);
      return;
    }

    if (window.electronAPI?.onUpdateProgress) {
      const unsubscribe = window.electronAPI.onUpdateProgress((p) => {
        setProgress(p);
      });
      return () => unsubscribe();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isElectron = Boolean(window.electronAPI?.isElectron);

  const handleStartUpdate = async () => {
    if (!updateInfo?.downloadUrl) return;

    if (isElectron && window.electronAPI?.downloadAndInstallUpdate) {
      setDownloading(true);
      setError(null);
      try {
        const res = await window.electronAPI.downloadAndInstallUpdate(updateInfo.downloadUrl);
        if (!res.success && res.error) {
          setError(res.error);
          setDownloading(false);
        }
      } catch (err) {
        setError(String(err));
        setDownloading(false);
      }
    } else {
      // Navegador ou Smart TV: abre o link da release
      window.open(updateInfo.downloadUrl, '_blank');
      onClose();
    }
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="tv-modal-overlay" onClick={downloading ? undefined : onClose}>
      <div
        className="tv-modal-content update-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 540 }}
      >
        <div className="update-modal-header">
          <div className="update-header-icon-badge">
            {isChecking ? (
              <div className="tv-spinner small" />
            ) : updateInfo?.hasUpdate ? (
              <Sparkles size={24} color="#f4e154" />
            ) : (
              <CheckCircle2 size={24} color="#4ade80" />
            )}
          </div>
          <div>
            <h2>
              {isChecking
                ? 'Verificando Atualizações...'
                : updateInfo?.hasUpdate
                ? 'Nova Versão Disponível!'
                : 'Você está Atualizado!'}
            </h2>
            <p className="update-subtitle">
              {isChecking
                ? 'Consultando os servidores do GitHub...'
                : updateInfo?.hasUpdate
                ? `Versão atual: v${updateInfo.currentVersion} ➔ Nova: v${updateInfo.latestVersion}`
                : `TVPlayer v${updateInfo?.currentVersion || '2.0.0'} é a versão mais recente.`}
            </p>
          </div>
          {!downloading && (
            <button type="button" className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          )}
        </div>

        <div className="update-modal-body">
          {error && (
            <div className="update-error-banner">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {updateInfo?.hasUpdate && (
            <>
              {updateInfo.releaseNotes && (
                <div className="update-release-notes">
                  <div className="notes-label">O que há de novo:</div>
                  <pre className="notes-text">{updateInfo.releaseNotes}</pre>
                </div>
              )}

              {downloading ? (
                <div className="update-progress-container">
                  <div className="progress-info-row">
                    <span>Baixando atualização...</span>
                    <strong>{progress ? `${progress.percent}%` : 'Conectando...'}</strong>
                  </div>
                  <div className="update-progress-track">
                    <div
                      className="update-progress-fill"
                      style={{ width: `${progress ? progress.percent : 5}%` }}
                    />
                  </div>
                  {progress && progress.totalBytes > 0 && (
                    <div className="progress-bytes-label">
                      {formatBytes(progress.receivedBytes)} de {formatBytes(progress.totalBytes)}
                    </div>
                  )}
                  <p className="update-wait-hint">
                    Ao concluir, o instalador será iniciado automaticamente para aplicar a atualização.
                  </p>
                </div>
              ) : (
                <div className="update-details-summary">
                  {updateInfo.assetSize ? (
                    <span>Tamanho: <strong>{formatBytes(updateInfo.assetSize)}</strong></span>
                  ) : null}
                  {updateInfo.assetName ? (
                    <span>Arquivo: <code>{updateInfo.assetName}</code></span>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        <div className="update-modal-footer">
          {downloading ? (
            <div className="downloading-badge">
              <div className="tv-spinner small" /> Aplicando atualização...
            </div>
          ) : updateInfo?.hasUpdate ? (
            <>
              <button type="button" className="tv-btn secondary" onClick={onClose}>
                Lembrar Mais Tarde
              </button>
              <button
                type="button"
                className="tv-btn primary update-action-btn"
                onClick={handleStartUpdate}
              >
                {isElectron ? (
                  <>
                    <Download size={18} />
                    <span>Baixar e Atualizar Agora</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight size={18} />
                    <span>Baixar no GitHub</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <button type="button" className="tv-btn primary" onClick={onClose}>
              OK, Entendido
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
