# 🚀 TVPlayer Desktop v2.0 — O Grande Salto Híbrido

A versão **2.0** representa o maior marco da história do **TVPlayer Desktop**. Abandonamos arquiteturas legadas e unificamos o ecossistema com um motor de altíssimo desempenho, entregando uma experiência moderna, fluida e visualmente inspirada nas principais plataformas de streaming do mundo, **sem depender de nenhum codec externo** e com atualização automática garantida.

---

## ✨ Principais Novidades da Versão 2.0

### 🎬 1. Nova Interface Netflix-Grade com Tema Dark
- Design escuro profissional de alto contraste (`#141414` e `#E50914`), desenvolvido para extremo conforto visual.
- Novo ícone oficial em alta definição com preenchimento sólido.
- Navegação lateral compacta (*Navigation Rail*) com transições instantâneas entre Categorias, Todos os Canais, Favoritos, Histórico de Recentes e Configurações.

### ⏩ 2. Reprodutor VOD & Scrubber Bar Ultra-Fluido
- **Barra de progresso sem engasgos**: Avanço e retrocesso contínuos e responsivos em filmes e séries.
- **Painel flutuante de controles**: Atalhos instantâneos para "Início", "Ep -" / "CH -" e "Ep +" / "CH +".
- **Sugestão Inteligente de Próximo Episódio**: Contagem regressiva de alta precisão ao final do episódio com botão de ação rápida para maratonar séries.
- **Marcação Automática de Visto**: Limite flexível (90% para filmes e 95% para episódios curtos).

### 📁 3. Organização Automática de Séries
- Identificação inteligente de padrões de episódios (`S01E01`, `1x01`, `T01E01`, `Cap.`).
- Agrupamento automático de canais e vídeos em **Pastas por Série** e **Pastas por Temporada**, trazendo ordem e clareza para listas gigantescas.

### 📱 4. Pareamento Remoto via QR Code & Nuvem
- Envie suas listas M3U ou credenciais Xtream Codes diretamente pelo smartphone ou navegador acessando [admjorgeluiz.github.io/tv](https://admjorgeluiz.github.io/tv/).
- Pareamento sem fio via nuvem: sem necessidade de digitar URLs compridas no teclado do computador.

### 🔒 5. Controle Parental (+18) com Teclado Numérico
- Categorias e canais adultos ocultos por padrão para proteção da família.
- Teclado numérico virtual na tela e suporte a teclado físico para desbloqueio e alteração de PIN de segurança.

---

## 🛠️ Melhorias Técnicas & de Infraestrutura

- **Motor Chromium Otimizado**: Aceleração gráfica direta por hardware (DirectX / D3D11) com renderização fluida em até 60fps.
- **Zero Dependência de Codecs Externos**: Os pacotes `hls.js` e `mpegts.js` integrados cuidam de toda a desmultiplexação de streams IPTV (`.ts`, `MPEG-TS`, `m3u8`), eliminando a necessidade de instalar pacotes de codecs adicionais no Windows.
- **Transparência de Rede (Sem CORS)**: Comunicação direta com servidores IPTV externos sem bloqueios de certificados ou cabeçalhos restritivos.
- **Atalhos Rápidos de Teclado**:
  - `F11` ou duplo clique: Alternar tela cheia nativa.
  - `Espaço`: Play / Pause.
  - `◄ / ►`: Retroceder / Avançar 10 segundos no VOD.
  - `▲ / ▼`: Ajuste de volume.
  - `Esc`: Fechar modais ou sair do modo tela cheia.

---

## 📦 Como Atualizar

1. Baixe o instalador anexado abaixo: **`setupTVPlayer_v2.0.exe`**.
2. Execute o arquivo instalador.
3. **Migração Automática**: O instalador detectará sua versão anterior (1.4 ou 1.5), desinstalará os arquivos legados de forma limpa e configurará o novo TVPlayer 2.0 com todos os atalhos atualizados.
