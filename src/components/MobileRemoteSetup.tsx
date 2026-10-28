import React, { useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  KeyRound,
  Link2,
  Send,
  Smartphone,
  Tv,
  Wifi,
} from 'lucide-react';
import { sendPlaylistToTV } from '../services/pairingService';

interface MobileRemoteSetupProps {
  initialPairCode: string;
  onExitRemoteMode?: () => void;
}

export const MobileRemoteSetup: React.FC<MobileRemoteSetupProps> = ({
  initialPairCode,
  onExitRemoteMode,
}) => {
  const [pairCode, setPairCode] = useState(initialPairCode.toUpperCase());
  const [tab, setTab] = useState<'url' | 'xtream' | 'file'>('url');

  const [m3uUrl, setM3uUrl] = useState('');
  const [serverUrl, setServerUrl] = useState('http://');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fileName, setFileName] = useState('');
  const [rawContent, setRawContent] = useState('');

  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSendUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairCode.trim() || !m3uUrl.trim()) return;
    setIsSending(true);
    setErrorMsg(null);
    setSentSuccess(false);
    try {
      await sendPlaylistToTV(pairCode, {
        type: 'm3u_url',
        m3uUrl: m3uUrl.trim(),
      });
      setSentSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao enviar lista para a TV.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendXtream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairCode.trim() || !serverUrl.trim() || !username.trim() || !password.trim()) return;
    setIsSending(true);
    setErrorMsg(null);
    setSentSuccess(false);
    try {
      await sendPlaylistToTV(pairCode, {
        type: 'xtream',
        serverUrl: serverUrl.trim(),
        username: username.trim(),
        password: password.trim(),
      });
      setSentSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao enviar credenciais Xtream para a TV.');
    } finally {
      setIsSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawContent(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleSendFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairCode.trim() || !rawContent) return;
    setIsSending(true);
    setErrorMsg(null);
    setSentSuccess(false);
    try {
      await sendPlaylistToTV(pairCode, {
        type: 'm3u_content',
        rawContent,
      });
      setSentSuccess(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao enviar arquivo para a TV.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mobile-companion-wrapper">
      <div className="mobile-companion-card">
        <div className="mobile-header">
          <div className="mobile-brand-badge">
            <Smartphone size={22} />
            <span>⇄</span>
            <Tv size={24} />
          </div>
          <h1>Configuração Remota da TV</h1>
          <p>Envie sua lista IPTV direto do celular ou PC para a sua Samsung Smart TV</p>
        </div>

        <div className="pair-code-banner">
          <div className="pair-code-left">
            <Wifi size={18} className="accent-cyan" />
            <span>Código da TV Conectada:</span>
          </div>
          <input
            type="text"
            className="pair-code-input"
            value={pairCode}
            onChange={(e) => setPairCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="CÓDIGO"
          />
        </div>

        <div className="mobile-tabs">
          <button
            type="button"
            className={`mobile-tab ${tab === 'url' ? 'active' : ''}`}
            onClick={() => {
              setTab('url');
              setSentSuccess(false);
            }}
          >
            <Link2 size={16} /> Link M3U
          </button>
          <button
            type="button"
            className={`mobile-tab ${tab === 'xtream' ? 'active' : ''}`}
            onClick={() => {
              setTab('xtream');
              setSentSuccess(false);
            }}
          >
            <KeyRound size={16} /> Xtream
          </button>
          <button
            type="button"
            className={`mobile-tab ${tab === 'file' ? 'active' : ''}`}
            onClick={() => {
              setTab('file');
              setSentSuccess(false);
            }}
          >
            <FileUp size={16} /> Arquivo
          </button>
        </div>

        {sentSuccess && (
          <div className="mobile-success-box">
            <CheckCircle2 size={32} color="#22c55e" />
            <div>
              <strong>Lista enviada para a TV!</strong>
              <p>Olhe para a tela da sua TV Samsung: o carregamento já iniciou automaticamente.</p>
            </div>
          </div>
        )}

        {errorMsg && <div className="mobile-error-box">{errorMsg}</div>}

        {tab === 'url' && (
          <form onSubmit={handleSendUrl} className="mobile-form">
            <label>Cole abaixo a URL da sua lista (.m3u ou .m3u8)</label>
            <textarea
              rows={3}
              placeholder="http://servidor.com/get.php?username=...&password=...&type=m3u_plus"
              value={m3uUrl}
              onChange={(e) => setM3uUrl(e.target.value)}
              required
            />
            <button
              type="submit"
              className="mobile-submit-btn"
              disabled={isSending || !m3uUrl.trim()}
            >
              <Send size={18} />
              <span>{isSending ? 'Enviando para a TV...' : 'Enviar Lista para a TV'}</span>
            </button>
          </form>
        )}

        {tab === 'xtream' && (
          <form onSubmit={handleSendXtream} className="mobile-form">
            <label>URL do Servidor (DNS:Porta)</label>
            <input
              type="text"
              placeholder="http://dns.exemplo.com:80"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              required
            />
            <label>Usuário</label>
            <input
              type="text"
              placeholder="Digite o usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <label>Senha</label>
            <input
              type="password"
              placeholder="Digite a senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" className="mobile-submit-btn" disabled={isSending}>
              <Send size={18} />
              <span>{isSending ? 'Enviando...' : 'Conectar Xtream na TV'}</span>
            </button>
          </form>
        )}

        {tab === 'file' && (
          <form onSubmit={handleSendFile} className="mobile-form">
            <label>Selecione um arquivo .m3u ou .m3u8 do seu aparelho</label>
            <input type="file" accept=".m3u,.m3u8,.txt" onChange={handleFileSelect} />
            {fileName && (
              <p className="file-loaded-info">
                Arquivo pronto: <strong>{fileName}</strong> ({(rawContent.length / 1024).toFixed(1)}{' '}
                KB)
              </p>
            )}
            <button
              type="submit"
              className="mobile-submit-btn"
              disabled={isSending || !rawContent}
            >
              <Send size={18} />
              <span>{isSending ? 'Transferindo para a TV...' : 'Enviar Arquivo para a TV'}</span>
            </button>
          </form>
        )}

        {onExitRemoteMode && (
          <button type="button" className="mobile-back-tv-btn" onClick={onExitRemoteMode}>
            Abrir Interface Completa do Player
          </button>
        )}
      </div>
    </div>
  );
};
