# EDF_Oeste

**Gestão de Edifícios e Manutenção**  
**Autor: RJP**

## O que inclui

- WebApp/PWA instalável no telemóvel e PC.
- App Android via Capacitor.
- Ícone próprio para o telemóvel: `public/edf-oeste-icon.svg`.
- Cores verde técnico.
- Cadastro de edifícios.
- Inspeções com fotos, medidas, custos e prazos.
- Importação/exportação Excel.
- Relatórios PDF.
- Separador de sincronização Google.
- Apps Script base em `google-apps-script/Code.gs`.

## Como a WebApp conversa com a App Android

Ambas usam o mesmo endpoint do Google Apps Script:
- Google Sheets guarda os dados.
- Google Drive será usado para fotos e PDFs.
- A app Android e a WebApp enviam/recebem os mesmos dados.

## Android

Nome: `EDF_Oeste`  
Package: `pt.rjp.edfoeste`

## GitHub

Enviar todos estes ficheiros para o repositório e correr:
- Build EDF_Oeste WebApp
- Build EDF_Oeste APK
