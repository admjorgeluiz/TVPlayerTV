# TVPlayer Smart TV (Samsung Tizen & LG webOS)

Aplicativo híbrido IPTV moderno e de alta performance desenvolvido para Smart TVs **Samsung (Tizen OS)** e **LG (webOS)**, construído com React 18, TypeScript e Vite.

---

## 🚀 Principais Funcionalidades

- **Multiplataforma Híbrido**: Código unificado gerando instaladores nativos para **Samsung Tizen (`.wgt`)** e **LG webOS (`.ipk`)**.
- **Controle Remoto Total (D-Pad & LG Magic Remote)**:
  - Navegação espacial completa em todas as direções (Listas, Busca, Categorias, Configurações).
  - Suporte ao ponteiro "air mouse" e scroll wheel do controle Magic Remote da LG.
  - Zapping numérico direto (`0-9`), atalhos de botões coloridos (`Vermelho`, `Verde`, `Amarelo`, `Azul`) e `CH+` / `CH-`.
- **Organização Inteligente de Séries (`S01E01`)**:
  - Detecção automática de temporadas e episódios (`S01E01`, `1x01`, `T01E01`, `Cap.`).
  - Agrupamento em **Pastas por Série** e **Pastas por Temporada**.
- **Controle Parental Duplo (+18)**:
  - Categorias e canais adultos ocultos por padrão para proteção da família.
  - Ativação do selo `+18` mediante confirmação da Senha Parental.
  - Teclado virtual numérico na tela para troca de PIN e desbloqueio diretamente pelo controle remoto.
- **Configuração Remota via QR Code**:
  - Pareamento sem fio via nuvem através de [admjorgeluiz.github.io/tv](https://admjorgeluiz.github.io/tv/).
  - Envio instantâneo de listas `.m3u` ou credenciais **Xtream Codes** pelo smartphone ou computador (sem depender de servidor local ou rede Wi-Fi idêntica).
- **Motores de Vídeo**:
  - Decodificador de hardware Samsung `webapis.avplay` (HEVC/AC3/MPEG-TS).
  - `HLS.js` e `mpegts.js` para streaming de baixa latência e compatibilidade webOS / HTML5 MSE.

---

## 🛠️ Comandos de Build e Deploy

### 1. Instalação de Dependências
```bash
npm install
```

### 2. Desenvolvimento Local
```bash
npm run dev
```

### 3. Samsung Tizen
```bash
# Gerar pacote assinado .wgt
npm run tizen:pack

# Gerar e instalar diretamente na TV Samsung conectada via SDB
npm run tizen:deploy
```

### 4. LG webOS
```bash
# Gerar pacote instalador .ipk
npm run lg:pack

# Gerar e instalar diretamente na TV LG configurada via Developer Mode
npm run lg:deploy
```

---

## 📄 Licença e Direitos
Desenvolvido por **Jorge Nascimento** ([@admjorgeluiz](https://github.com/admjorgeluiz)). Todos os direitos reservados.
