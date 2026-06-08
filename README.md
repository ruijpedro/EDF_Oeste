# EDF_Oeste

Gestão de Edifícios e Manutenção  
Autor: RJP

## Versão corrigida

Esta versão foi refeita para resolver o erro:

`Directory android does not contain a Gradle build`

A pasta Android incompleta foi removida. O GitHub Actions agora cria automaticamente o projeto Android completo com Capacitor.

## Como usar

1. Faz upload de todos os ficheiros/pastas deste ZIP para a raiz do repositório.
2. No GitHub, abre **Actions**.
3. Executa **Build EDF_Oeste APK**.
4. O APK aparece em **Artifacts**.

## O workflow agora faz automaticamente

```bash
npm install
npm run build
rm -rf android
npx cap add android
npx cap sync android
node scripts/prepare-android-icons.js
cd android
./gradlew assembleDebug
```

## Ícone

O ícone é aplicado depois de o Android ser criado.  
Usa os ficheiros:

- `public/icon-192.png`
- `public/icon-512.png`

Se o telemóvel mostrar o ícone antigo, desinstala primeiro a app antiga e instala a nova APK.
