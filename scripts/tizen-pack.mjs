import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const distDir = path.resolve(process.cwd(), 'dist');
const shouldDeploy = process.argv.includes('--deploy');
const tvIp = process.env.TV_IP || '192.168.68.108';
const certProfile = process.env.TIZEN_PROFILE || 'TVSamsungSalaParque';
const appId = 'TVPlayer01.TVPlayerTizen';

// 1. Adapta dist/index.html para execução local no Tizen 6.0+ (Chromium 76+)
const indexPath = path.join(distDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf-8');

  // Remove type="module" e crossorigin para permitir execução direta do bundle moderno via file:/// (com defer para garantir que o #root já exista no DOM)
  html = html.replace(/<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>/gi, '<script defer src="$1"></script>');
  html = html.replace(/<script\s+type="module"\s+src="([^"]+)"><\/script>/gi, '<script defer src="$1"></script>');
  html = html.replace(/<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">/gi, '<link rel="stylesheet" href="$1">');

  // Adiciona interceptor de erros amigável em caso de falha de renderização
  if (!html.includes('id="tizen-error-guard"')) {
    const errorGuard = `
    <script id="tizen-error-guard">
      window.addEventListener('error', function(e) {
        var root = document.getElementById('root');
        if (root && (!root.children || root.children.length === 0)) {
          var errBox = document.createElement('div');
          errBox.style = 'color: #ff5555; background: #0b0f17; border: 2px solid #ef4444; padding: 24px; font-family: monospace; font-size: 16px; z-index: 99999; position: fixed; top: 20px; left: 20px; right: 20px; border-radius: 12px;';
          errBox.innerHTML = '<h3 style="color:#ef4444;margin-bottom:10px;">⚠️ Erro de Carregamento:</h3><pre style="white-space:pre-wrap;">' + (e.message || e) + '\\n' + (e.filename || '') + ':' + (e.lineno || '') + '</pre>';
          root.appendChild(errBox);
        }
      });
    </script>`;
    html = html.replace('</body>', `${errorGuard}\n  </body>`);
  }

  fs.writeFileSync(indexPath, html, 'utf-8');
  console.log('✅ dist/index.html adaptado para execução moderna e rápida em Tizen 6.0+ (sem CORS em file://)');
}

const dotProjectXml = `<?xml version="1.0" encoding="UTF-8"?>
<projectDescription>
	<name>TVPlayerTizen</name>
	<comment></comment>
	<projects></projects>
	<buildCommand>
		<name>json.validation.builder</name>
		<arguments></arguments>
	</buildCommand>
	<buildSpec>
		<buildCommand>
			<name>org.tizen.web.project.builder.WebBuilder</name>
			<arguments></arguments>
		</buildCommand>
	</buildSpec>
	<natures>
		<nature>org.tizen.web.project.builder.WebNature</nature>
		<nature>org.eclipse.wst.jsdt.core.jsNature</nature>
	</natures>
</projectDescription>`;

const dotTprojectXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<tproject xmlns="http://www.tizen.org/tproject">
    <platforms>
        <platform>
            <name>tv-samsung-6.0</name>
        </platform>
    </platforms>
    <package>
        <blacklist/>
    </package>
</tproject>`;

fs.writeFileSync(path.join(distDir, '.project'), dotProjectXml, 'utf-8');
fs.writeFileSync(path.join(distDir, '.tproject'), dotTprojectXml, 'utf-8');

console.log('\n✅ Arquivos de manifesto Samsung Tizen (.project, .tproject, config.xml para Tizen 6.0+) preparados em ./dist');

const tizenCliPath = 'C:\\tizen-studio\\tools\\ide\\bin\\tizen.bat';
const sdbPath = 'C:\\tizen-studio\\tools\\sdb.exe';

if (fs.existsSync(tizenCliPath)) {
  // Remove arquivos .ipk (LG) de ./dist antes de gerar o .wgt (Samsung) para não duplicar tamanho
  for (const f of fs.readdirSync(distDir)) {
    if (f.endsWith('.ipk') || f.endsWith('.wgt')) {
      fs.unlinkSync(path.join(distDir, f));
    }
  }
  console.log(`📦 Gerando pacote .wgt assinado com perfil "${certProfile}"...`);
  execSync(`"${tizenCliPath}" package -t wgt -s ${certProfile} -- "${distDir}"`, { stdio: 'inherit' });

  const wgtFiles = fs.readdirSync(distDir).filter((f) => f.endsWith('.wgt'));
  const wgtFile = wgtFiles[0];
  console.log(`\n🎉 Pacote ${wgtFile} gerado e assinado com sucesso em ./dist!`);

  if (shouldDeploy && fs.existsSync(sdbPath) && wgtFile) {
    const localWgtPath = path.join(distDir, wgtFile);
    const remoteWgtPath = '/home/owner/share/tmp/sdk_tools/tmp/TVPlayerTizen.wgt';

    console.log(`\n📺 Conectando à TV Samsung em ${tvIp}...`);
    try {
      execSync(`"${sdbPath}" connect ${tvIp}`, { stdio: 'inherit' });
    } catch (e) {
      console.warn('Conexão SDB já ativa ou respondeu com aviso.');
    }

    console.log('🚀 Enviando pacote para a TV...');
    execSync(`"${sdbPath}" push "${localWgtPath}" ${remoteWgtPath}`, { stdio: 'inherit' });

    console.log('⚙️ Instalando aplicativo nativo via vd_appinstall...');
    execSync(`"${sdbPath}" shell 0 vd_appinstall ${appId} ${remoteWgtPath}`, { stdio: 'inherit' });

    console.log('▶️ Abrindo TVPlayerTizen na TV...');
    execSync(`"${sdbPath}" shell 0 was_execute ${appId}`, { stdio: 'inherit' });
    console.log('\n✨ Aplicativo instalado e aberto na sua Samsung Smart TV!');
  }
}
