import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectDir = process.cwd();
const distDir = path.join(projectDir, 'dist');
const releasesDir = path.join(projectDir, 'releases');

if (!fs.existsSync(distDir)) {
  console.log('🏗️ Pasta dist não encontrada. Rodando build da aplicação web...');
  execSync('npm run build', { stdio: 'inherit' });
}

if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
}

console.log('\n📦 1/2: Gerando binários descompactados do Windows com Electron...');
execSync('npx electron-builder --dir --config electron-builder.json', { stdio: 'inherit' });

// Localizar o Inno Setup Compiler (ISCC.exe)
const possibleIsccPaths = [
  path.join(process.env.LOCALAPPDATA || '', 'Programs\\Inno Setup 6\\ISCC.exe'),
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
];

let isccPath = possibleIsccPaths.find((p) => fs.existsSync(p));

if (!isccPath) {
  console.error('❌ Compilador Inno Setup (ISCC.exe) não encontrado.');
  process.exit(1);
}

console.log(`\n⚙️ 2/2: Empacotando com Inno Setup via: ${isccPath}`);
const issFile = path.join(projectDir, 'installer.iss');
execSync(`"${isccPath}" "${issFile}"`, { stdio: 'inherit' });

const finalSetup = path.join(releasesDir, 'setupTVPlayer_v2.0.exe');
if (fs.existsSync(finalSetup)) {
  const stats = fs.statSync(finalSetup);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n🎉 INSTALADOR CRIADO COM SUCESSO!`);
  console.log(`📁 Arquivo: ${finalSetup}`);
  console.log(`⚖️ Tamanho: ${sizeMb} MB`);
} else {
  console.log('\n✨ Concluído! Verifique a pasta ./releases/');
}
