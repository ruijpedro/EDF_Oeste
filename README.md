# EDF_Oeste - Ícone Android Final

Gestão de Edifícios e Manutenção  
Autor: RJP

## Correção do ícone genérico

Esta versão deixa de depender de copiar manualmente `ic_launcher.png`.

Agora usa o método correto:

- `assets/icon.png`
- `@capacitor/assets`
- `npx capacitor-assets generate --android`

O GitHub Actions cria todos os ícones Android, incluindo os ícones adaptativos usados pelo Android moderno.

## Como usar

1. Substitui todos os ficheiros do repositório por este ZIP.
2. Apaga a pasta `android` antiga do GitHub, se existir.
3. Faz upload deste ZIP extraído.
4. Corre o workflow **Build EDF_Oeste APK**.
5. Desinstala a app antiga no telemóvel.
6. Reinicia o telemóvel.
7. Instala a nova APK.

## Importante

Se continuares a ver o ícone genérico, estás provavelmente a instalar um APK antigo.  
Confirma que o artifact descarregado é o novo `EDF_Oeste_APK`.
