import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const distDir = path.resolve(process.cwd(), 'dist');
const shouldDeploy = process.argv.includes('--deploy');
const tvIp = process.env.TV_IP || '192.168.68.117';
const certProfile = process.env.TIZEN_PROFILE || 'TVSamsungSala';
const appId = 'TVPlayer01.TVPlayerTizen';

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
            <name>tv-samsung-8.0</name>
        </platform>
    </platforms>
    <package>
        <blacklist/>
    </package>
</tproject>`;

fs.writeFileSync(path.join(distDir, '.project'), dotProjectXml, 'utf-8');
fs.writeFileSync(path.join(distDir, '.tproject'), dotTprojectXml, 'utf-8');

console.log('\n✅ Arquivos de manifesto Samsung Tizen (.project, .tproject, config.xml) preparados em ./dist');

const tizenCliPath = 'C:\\tizen-studio\\tools\\ide\\bin\\tizen.bat';
const sdbPath = 'C:\\tizen-studio\\tools\\sdb.exe';

if (fs.existsSync(tizenCliPath)) {
  // Remove arquivos .ipk (LG) de ./dist antes de gerar o .wgt (Samsung) para não duplicar tamanho
  for (const f of fs.readdirSync(distDir)) {
    if (f.endsWith('.ipk')) {
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
    execSync(`"${sdbPath}" connect ${tvIp}`, { stdio: 'inherit' });

    console.log('🚀 Enviando pacote para a TV...');
    execSync(`"${sdbPath}" push "${localWgtPath}" ${remoteWgtPath}`, { stdio: 'inherit' });

    console.log('⚙️ Instalando aplicativo nativo via vd_appinstall...');
    execSync(`"${sdbPath}" shell 0 vd_appinstall ${appId} ${remoteWgtPath}`, { stdio: 'inherit' });

    console.log('▶️ Abrindo TVPlayerTizen na TV...');
    execSync(`"${sdbPath}" shell 0 was_execute ${appId}`, { stdio: 'inherit' });
    console.log('\n✨ Aplicativo instalado e aberto na sua Samsung Smart TV!');
  }
}
