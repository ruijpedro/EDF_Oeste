# EDF_Oeste_GoogleDrive_Sheets

Versão com:
- Google Login
- Google Sheets API
- Google Drive API
- Google Calendar API
- Upload de fotos para Drive
- PDF para Drive
- Leitura das três folhas:
  - Folha_Classificacao_Edificios_Linha_Oeste_RJP
  - Lista de edifícios
  - Estações e Apeadeiros

Configurar na app:
- API Key
- Client ID
- Spreadsheet ID
- Drive Folder ID
- Calendar ID


## Configuração Google

Na app, abrir o separador **Google** e preencher:

```text
API Key
Client ID
Spreadsheet ID
Drive Folder ID
Calendar ID
```

Depois clicar em:

```text
Guardar
Ligar Google
Ler 3 folhas
```

## Logótipos e ícones

Consultar:

```text
LOGOTIPOS_E_ICONES.md
```


## Logo e ícone integrados

Foi integrado o ficheiro enviado no ZIP:

```text
1024.png
```

Locais atualizados:
- `public/ip-logo.png` ou `public/ip-logo.svg`
- `assets/icon.png`
- `assets/splash.png`
- `public/favicon.png`
- `public/icon-192.png`
- `public/icon-512.png`

O workflow Android usa `@capacitor/assets` para gerar automaticamente os ícones Android.

## v2 — Conta Google como base principal

Esta versão guarda tudo na tua conta Google:
- Google Drive: pastas EDF_Oeste, Fotografias, PDF, Documentos e subpastas por estação.
- Google Sheets: ficheiro EDF_Oeste_DB com Edificios, Inspecoes, Fotos, PDF, Intervencoes, Custos e Documentos.
- Google Calendar: eventos de próximas inspeções.

Uso:
1. Separador Google.
2. Preencher API Key e Client ID.
3. Ligar Google.
4. Criar estrutura Google.
5. Ler dados.


## v3 — Importar Excel diretamente do Google Drive

Novo separador:

```text
Importar Excel
```

Botões:
- Procurar Excel
- Atualizar Tudo

A app procura no Google Drive a pasta:

```text
Edificios Oeste
```

e importa automaticamente:

```text
Estações e Apeadeiros.xlsx
Lista de edificios.xlsx
Folha_Classificacao_Edificios_Linha_Oeste_RJP.xlsx
```

Depois grava os dados no ficheiro Google Sheets:

```text
EDF_Oeste_DB
```

com as folhas:
- Estacoes
- Edificios
- Classificacao
- Inspecoes
- Fotos
- PDF
- Intervencoes
- Custos
- Documentos


## v4 — Google Bridge para APK + WebApp

Esta versão resolve o problema do login Google no APK.

A APK e a WebApp comunicam com um Google Apps Script publicado como Web App.

### Como configurar

1. Criar projeto Apps Script.
2. Colar o conteúdo de:

```text
google-apps-script/Code.gs
```

3. No Apps Script, ativar o serviço avançado:
   - Drive API

4. No Google Cloud associado, ativar:
   - Google Drive API
   - Google Sheets API
   - Google Calendar API

5. Publicar:
   - Deploy > New deployment
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone with the link

6. Copiar o URL terminado em `/exec`.

7. Na app:
   - Google Bridge
   - Colar URL
   - Guardar
   - Testar ligação
   - Criar estrutura Google
   - Importar Excel > Atualizar Tudo
