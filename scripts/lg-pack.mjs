import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const releasesDir = path.resolve(process.cwd(), 'releases');
const shouldDeploy = process.argv.includes('--deploy');
const targetDevice = process.env.LG_DEVICE || 'lgtv';

if (!fs.existsSync(distDir)) {
  console.error('❌ Pasta ./dist não encontrada. Rode "npm run build" antes.');
  process.exit(1);
}

if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
}

try {
  // Se houver .wgt dentro de ./dist, move temporariamente para ./releases para não entrar no .ipk
  for (const f of fs.readdirSync(distDir)) {
    if (f.endsWith('.wgt')) {
      fs.renameSync(path.join(distDir, f), path.join(releasesDir, f));
    }
  }

  console.log('📦 Gerando pacote instalador LG webOS (.ipk) em ./releases...');
  execSync(`npx ares-package "${distDir}" -o "${releasesDir}" --no-minify`, {
    stdio: 'inherit',
  });

  // Devolve o .wgt para ./dist também para manter compatibilidade com tizen-pack.mjs
  for (const f of fs.readdirSync(releasesDir)) {
    if (f.endsWith('.wgt')) {
      fs.copyFileSync(path.join(releasesDir, f), path.join(distDir, f));
    }
  }

  const ipkFile = path.join(releasesDir, 'com.jorgenascimento.tvplayer_1.0.0_all.ipk');
  console.log(`🎉 Pacote LG webOS (.ipk) pronto em: ${ipkFile}`);

  if (shouldDeploy) {
    console.log(`📺 Instalando pacote .ipk na TV LG (${targetDevice})...`);
    execSync(`npx ares-install --device ${targetDevice} "${ipkFile}"`, {
      stdio: 'inherit',
    });
    console.log(`▶️ Abrindo TVPlayer na TV LG (${targetDevice})...`);
    execSync(`npx ares-launch --device ${targetDevice} com.jorgenascimento.tvplayer`, {
      stdio: 'inherit',
    });
    console.log('✨ Aplicativo instalado e aberto na sua LG Smart TV!');
  }
} catch (err) {
  console.error('⚠️ Erro ao empacotar/instalar para LG webOS:', err.message);
  process.exit(1);
}
