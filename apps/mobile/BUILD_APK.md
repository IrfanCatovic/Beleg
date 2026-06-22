# Planiner — Android APK (probna verzija)

Konfiguracija je spremna. Backend: `https://planiner-api.onrender.com`

Aplikacija se na telefonu zove **Planiner**, sa ikonom iz `public/LogoP.jpg` (`apps/mobile/assets/icon.jpg`).

## Jednokratna priprema (tvoj Expo nalog)

U terminalu, iz foldera `apps/mobile`:

```powershell
cd apps\mobile
npm install
npm run eas:login
npm run eas:init
```

- **eas:login** — prijavi se na [expo.dev](https://expo.dev) (besplatan nalog).
- **eas:init** — povezuje projekat i upisuje `projectId` u `app.json`.

## Napravi APK

```powershell
npm run build:apk
```

Build traje ~10–20 min na Expo serverima. Na kraju dobiješ **link za preuzimanje .apk** fajla.

## Instalacija na Samsung

1. Preuzmi APK na telefon (link iz builda ili prebaci fajl).
2. Otvori fajl → dozvoli **„Instalacija nepoznatih aplikacija”** za Chrome/fajl menadžer ako traži.
3. Instaliraj **Planiner**.
4. Pri prvom korišćenju:
   - **Dnevni koraci** → tapni **„Omogući brojač koraka”** → u sistemskom prozoru izaberi **Dozvoli** (Fizička aktivnost).
   - **Započni akciju** (kad bude aktivno) → dozvola za **Lokaciju**.
   - **Profil / slike** → dozvola za **Slike** (galerija).

## Dozvole u aplikaciji

| Funkcija | Kada se pita | Android postavka |
|----------|--------------|------------------|
| Koraci | Kartica Dnevni koraci | Dozvole → Fizička aktivnost |
| GPS ruta | Započni akciju | Dozvole → Lokacija |
| Slike | Avatar, cover, akcije | Dozvole → Slike |

## Dijeljenje test korisnicima

Pošalji im **isti APK link** ili fajl. Svaki Android korisnik instalira isto kao gore.

## Napomene

- Render free tier: prvi login nakon pauze može trajati 30–60 s.
- Za Google Play kasnije koristi `eas build -p android --profile production` (AAB, ne APK).
