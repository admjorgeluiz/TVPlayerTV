import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'node:os';

interface PairPayload {
  type: 'm3u_url' | 'xtream' | 'm3u_content';
  m3uUrl?: string;
  serverUrl?: string;
  username?: string;
  password?: string;
  rawContent?: string;
  timestamp: number;
}

function getLocalLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
        return iface.address;
      }
    }
  }
  return '192.168.68.106';
}

function renderInstantMobileHtml(pairCode: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>TVPlayer - Enviar Lista para Samsung TV</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(160deg, #041c32 0%, #06111c 100%);
      color: #f8fafc;
      min-height: 100vh;
      padding: 20px 14px 40px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .card {
      width: 100%;
      max-width: 460px;
      background: #111827;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 20px;
      padding: 22px 18px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.65);
    }
    .badge {
      display: inline-block;
      background: linear-gradient(135deg, #6d3ef2, #2563eb);
      color: #fff;
      font-weight: 800;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 20px;
      margin-bottom: 10px;
    }
    h1 { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
    .sub { font-size: 13px; color: #94a3b8; margin-bottom: 16px; }
    .code-row {
      background: rgba(56,189,248,0.12);
      border: 1px solid rgba(56,189,248,0.35);
      border-radius: 12px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      font-size: 13px;
      font-weight: 700;
    }
    .code-input {
      width: 105px;
      background: #0b0f17;
      border: 1px solid #38bdf8;
      border-radius: 8px;
      color: #f4e154;
      font-weight: 900;
      font-size: 16px;
      text-align: center;
      padding: 6px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .tabs {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      background: #0b0f17;
      padding: 5px;
      border-radius: 12px;
      margin-bottom: 16px;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 10px 6px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .tab-btn.active {
      background: #6d3ef2;
      color: #fff;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #e2e8f0;
      margin-bottom: 6px;
      margin-top: 10px;
    }
    input[type="text"], input[type="url"], input[type="password"], textarea, input[type="file"] {
      width: 100%;
      background: #0b0f17;
      border: 1.5px solid rgba(255,255,255,0.18);
      border-radius: 10px;
      padding: 12px;
      color: #fff;
      font-size: 15px;
      font-family: inherit;
    }
    textarea { resize: vertical; min-height: 85px; }
    .submit-btn {
      width: 100%;
      margin-top: 16px;
      background: linear-gradient(135deg, #6d3ef2, #3b82f6);
      border: none;
      color: #fff;
      padding: 14px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
    }
    .msg {
      margin-bottom: 14px;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      display: none;
    }
    .msg.ok { display: block; background: rgba(34,197,94,0.16); border: 1px solid #22c55e; color: #bbf7d0; }
    .msg.err { display: block; background: rgba(239,68,68,0.18); border: 1px solid #ef4444; color: #fecaca; }
    .pane { display: none; }
    .pane.active { display: block; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align:center;">
      <span class="badge">CELULAR / PC ➔ SAMSUNG TV</span>
      <h1>Configurar Lista na TV</h1>
      <p class="sub">Envie sua lista IPTV instantaneamente sem digitar no controle remoto</p>
    </div>

    <div class="code-row">
      <span>Código da TV:</span>
      <input id="pairCode" class="code-input" type="text" value="${pairCode}" maxlength="8" />
    </div>

    <div id="statusMsg" class="msg"></div>

    <div class="tabs">
      <button type="button" class="tab-btn active" onclick="switchTab('url', this)">Link M3U</button>
      <button type="button" class="tab-btn" onclick="switchTab('xtream', this)">Xtream</button>
      <button type="button" class="tab-btn" onclick="switchTab('file', this)">Arquivo</button>
    </div>

    <div id="pane-url" class="pane active">
      <label>Cole a URL da sua lista (.m3u ou .m3u8)</label>
      <textarea id="m3uUrl" placeholder="http://servidor.com/get.php?username=...&password=...&type=m3u_plus"></textarea>
      <button type="button" class="submit-btn" onclick="sendUrl()">Enviar Lista para a TV Agora</button>
    </div>

    <div id="pane-xtream" class="pane">
      <label>Servidor (DNS:Porta)</label>
      <input id="serverUrl" type="text" placeholder="http://dns.servidor.com:80" value="http://" />
      <label>Usuário</label>
      <input id="username" type="text" placeholder="Seu usuário" />
      <label>Senha</label>
      <input id="password" type="password" placeholder="Sua senha" />
      <button type="button" class="submit-btn" onclick="sendXtream()">Conectar Xtream na TV</button>
    </div>

    <div id="pane-file" class="pane">
      <label>Selecione um arquivo .m3u do celular/PC</label>
      <input id="m3uFile" type="file" accept=".m3u,.m3u8,.txt" />
      <button type="button" class="submit-btn" onclick="sendFile()">Enviar Arquivo para a TV</button>
    </div>
  </div>

  <script>
    function switchTab(name, btn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('pane-' + name).classList.add('active');
      document.getElementById('statusMsg').className = 'msg';
    }

    function showStatus(text, isErr) {
      var el = document.getElementById('statusMsg');
      el.textContent = text;
      el.className = 'msg ' + (isErr ? 'err' : 'ok');
    }

    async function postPayload(payload) {
      var code = document.getElementById('pairCode').value.trim().toUpperCase();
      if (!code) return showStatus('Informe o código da TV.', true);
      showStatus('Enviando para a sua Samsung TV...', false);
      try {
        payload.code = code;
        payload.timestamp = Date.now();
        var res = await fetch('/api/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        try {
          if (payload.type !== 'm3u_content') {
            fetch('https://ntfy.sh/tvplayer_samsung_' + code, {
              method: 'POST',
              body: JSON.stringify(payload)
            });
          }
        } catch (e) {}
        if (res.ok) {
          showStatus('✅ Lista enviada com sucesso! Olhe para a tela da sua TV Samsung: os canais já estão carregando!', false);
        } else {
          showStatus('Erro ao enviar para a TV.', true);
        }
      } catch (err) {
        showStatus('Falha de rede: verifique se o celular está no mesmo Wi-Fi.', true);
      }
    }

    function sendUrl() {
      var url = document.getElementById('m3uUrl').value.trim();
      if (!url) return showStatus('Cole o link .m3u primeiro.', true);
      postPayload({ type: 'm3u_url', m3uUrl: url });
    }

    function sendXtream() {
      var s = document.getElementById('serverUrl').value.trim().replace(/\\/+$/, '');
      var u = document.getElementById('username').value.trim();
      var p = document.getElementById('password').value.trim();
      if (!s || !u || !p) return showStatus('Preencha servidor, usuário e senha.', true);
      var built = s + '/get.php?username=' + encodeURIComponent(u) + '&password=' + encodeURIComponent(p) + '&type=m3u_plus&output=m3u8';
      postPayload({ type: 'xtream', serverUrl: s, username: u, password: p, m3uUrl: built });
    }

    function sendFile() {
      var fileInput = document.getElementById('m3uFile');
      if (!fileInput.files || !fileInput.files[0]) return showStatus('Selecione um arquivo .m3u primeiro.', true);
      var reader = new FileReader();
      reader.onload = function() {
        postPayload({ type: 'm3u_content', rawContent: reader.result });
      };
      reader.readAsText(fileInput.files[0]);
    }
  </script>
</body>
</html>`;
}

// Plugin Fullstack integrado ao Vite para servir a Página Mobile Instantânea e a API local de Pareamento QR Code
function tvPairingServerPlugin(): Plugin {
  const pairStore = new Map<string, PairPayload>();

  return {
    name: 'tv-pairing-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const urlObj = new URL(req.url || '/', 'http://localhost');

        // Se o celular/PC acessou pelo QR Code (?pair=XXXX) ou /remote, entrega HTML Mobile instantâneo (zero-JS-bundle)
        if (
          req.method === 'GET' &&
          (urlObj.searchParams.has('pair') || urlObj.pathname === '/remote')
        ) {
          const code = (urlObj.searchParams.get('pair') || '').trim().toUpperCase();
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(renderInstantMobileHtml(code));
          return;
        }

        if (urlObj.pathname.includes('webapis.js')) {
          res.setHeader('Content-Type', 'application/javascript');
          res.end('// Samsung Tizen WebAPIs browser stub');
          return;
        }

        if (urlObj.pathname === '/api/network-info' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              lanIp: getLocalLanIp(),
              port: server.config.server.port || 5173,
            })
          );
          return;
        }

        if (urlObj.pathname === '/api/pair' && req.method === 'GET') {
          const code = (urlObj.searchParams.get('code') || '').trim().toUpperCase();
          const data = pairStore.get(code) || null;
          if (data) {
            pairStore.delete(code);
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, payload: data }));
          return;
        }

        if (urlObj.pathname === '/api/pair' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const code = String(parsed.code || '').trim().toUpperCase();
              if (!code) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: 'Código de pareamento ausente' }));
                return;
              }
              pairStore.set(code, {
                type: parsed.type || 'm3u_url',
                m3uUrl: parsed.m3uUrl,
                serverUrl: parsed.serverUrl,
                username: parsed.username,
                password: parsed.password,
                rawContent: parsed.rawContent,
                timestamp: Date.now(),
              });
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
            } catch (err: any) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: err?.message || 'JSON inválido' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tvPairingServerPlugin()],
  build: {
    target: ['es2018', 'chrome69'],
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
  },
  server: {
    host: true,
    port: 5173,
  },
});
