; TVPlayer Modern Installer (Inno Setup)
; Substitui e desinstala versoes antigas automaticamente

#define MyAppName "TVPlayer"
#define MyAppVersion "2.0.0"
#define MyAppPublisher "Jorge Nascimento"
#define MyAppURL "https://github.com/admjorgeluiz/TVPlayerMAUI"
#define MyAppExeName "TVPlayer.exe"
#define SourceDir "dist-electron\win-unpacked"

[Setup]
AppId={{91717AF6-F752-4128-9E86-896646EB57D6}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=releases
OutputBaseFilename=setupTVPlayer_v2.0
SetupIconFile=public\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=TVPlayer Smart TV e Desktop Player
VersionInfoCopyright=Copyright (C) 2026 {#MyAppPublisher}

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
// Funcao para detectar e desinstalar versoes anteriores (v1.4, v1.5 ou antigas instaladas)
function GetOldUninstallString(): String;
var
  S: String;
begin
  Result := '';
  // 1. Checa chave especifica da v1.4
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TVPlayer versão 1.4', 'UninstallString', S) then
    Result := S
  // 2. Checa chave da v1.5
  else if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TVPlayer versão 1.5', 'UninstallString', S) then
    Result := S
  // 3. Checa pasta padrao se o unins000.exe existir
  else if FileExists(ExpandConstant('{autopf}\TVPlayer\unins000.exe')) then
    Result := ExpandConstant('"{autopf}\TVPlayer\unins000.exe"');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  OldUninstall: String;
  ResultCode: Integer;
begin
  if CurStep = ssInstall then
  begin
    OldUninstall := GetOldUninstallString();
    if OldUninstall <> '' then
    begin
      // Remove aspas se existirem
      if (Length(OldUninstall) > 0) and (OldUninstall[1] = '"') then
        OldUninstall := Copy(OldUninstall, 2, Length(OldUninstall) - 2);

      // Executa a desinstalacao silenciosa da versao antiga
      Exec(OldUninstall, '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
      Sleep(1000);
    end;
  end;
end;
