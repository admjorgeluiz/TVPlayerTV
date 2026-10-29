import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.resolve(process.cwd(), 'screenshots');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function capture() {
  console.log('🚀 Iniciando captura em 1920x1080 (Smart TV Resolution)...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();

  // 1. Desktop Hybrid Install Gate
  console.log('📸 1/4: Capturando Desktop Install Gate...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(outputDir, '01_desktop_install_gate.png') });

  // 2. Main TV Interface (Canais ao Vivo & Navigation Rail)
  console.log('📸 2/4: Capturando Tela Principal da Smart TV...');
  await page.goto('http://localhost:5173/?bypass=true', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: path.join(outputDir, '02_tv_main_dashboard.png') });

  // 3. Selecionar uma Categoria ou Lista Completa
  console.log('📸 3/4: Capturando Navegação de Canais & Categorias...');
  try {
    const navButtons = await page.$$('.nav-rail-btn');
    if (navButtons.length >= 2) {
      await navButtons[1].click(); // Aba Todos os Canais
      await new Promise(r => setTimeout(r, 2000));
      await page.screenshot({ path: path.join(outputDir, '03_channels_and_categories.png') });
    }
  } catch (err) {
    console.warn('Fallback Canais:', err);
  }

  // 4. Modal de Configurações & QR Code Pairing
  console.log('📸 4/4: Capturando Modal de Configurações, QR Code & Parental PIN...');
  try {
    const navButtons = await page.$$('.nav-rail-btn');
    if (navButtons.length >= 6) {
      await navButtons[5].click(); // QR / Lista
    } else if (navButtons.length >= 5) {
      await navButtons[4].click(); // Configurações
    }
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(outputDir, '04_qr_pairing_and_settings.png') });
  } catch (err) {
    console.warn('Fallback Settings:', err);
  }

  await browser.close();
  console.log('✨ 4 capturas de tela HD geradas com sucesso!');
}

capture().catch((err) => {
  console.error('Erro na captura:', err);
  process.exit(1);
});
