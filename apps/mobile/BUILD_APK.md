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

## Napravi APK (samo kad menjaš native deo)

Potreban je **jednom** (i posle svake promene native modula / `app.json` dozvola / `version` u `app.json`).

```powershell
npm run build:apk
```

Build traje ~10–20 min na Expo serverima. Na kraju dobiješ **link za preuzimanje .apk** fajla.

**Važno:** Stari APK bez `expo-updates` ne može da povuče OTA. Posle ove konfiguracije obavezno instaliraj **novi** APK (versionCode 7+).

## Započni avanturu (GPS + stiker)

Na tabu **Istraži** kartica **Započni avanturu** pokreće praćenje koraka, km, vremena i uspona. Ruta se crta na kraju; automatski se otvara **PLANINER stiker** za deljenje.

Za **čuvanje stikera u galeriju** i PNG export potreban je APK sa `react-native-view-shot` i `expo-media-library` (versionCode 7+). Samo praćenje i prikaz stikera na ekranu mogu raditi i preko OTA ako je native deo već u APK-u.

## Push obaveštenja (expo-notifications)

Poslovna obaveštenja (zadaci, akcije, klub, follow, finansije…) stižu kao **push na telefon**, ne kao email. Email ostaje samo za verifikaciju registracije i reset lozinke.

### Jednokratna priprema

1. Novi APK sa `expo-notifications` (versionCode 6+).
2. Pri prvom logovanju aplikacija traži dozvolu za **obaveštenja** — izaberi **Dozvoli**.
3. Za produkcioni Android push, u Expo nalogu proveri FCM credentials: `eas credentials` (EAS automatski koristi `projectId` iz `app.json`).

**Novi native modul (expo-notifications)** zahteva **novi APK build** (`npm run build:apk`). Posle toga, izmene samo u JS mogu preko OTA.

## Mapa avantura (MapLibre + MapTiler — isto kao web)

Mobilna **Mapa avantura** koristi **MapLibre** i **MapTiler** stil — isti izgled kao na [planiner.com/mapa](https://planiner.com/mapa). **Ne treba Google Maps ključ.**

### Jednokratna priprema

1. Ako web mapa već radi, imaš `VITE_MAPTILER_API_KEY` u root `.env` (ili `VITE_MAP_STYLE_URL`).
2. U `apps/mobile/.env` dodaj **isti** ključ:
   ```
   EXPO_PUBLIC_MAPTILER_API_KEY=tvoj_maptiler_kljuc
   ```
   Opciono: `EXPO_PUBLIC_MAPTILER_MAP_ID=outdoor` (ili `streets-v4` kao na webu).
3. Besplatan nalog: [maptiler.com](https://www.maptiler.com/)

Za EAS cloud build, isti ključ možeš dodati u Expo → Environment variables kao `EXPO_PUBLIC_MAPTILER_API_KEY`.

**Novi native modul (MapLibre)** zahteva **novi APK build** (`npm run build:apk`). Posle toga, izmene samo u JS mogu preko OTA.

## OTA update (bez novog APK-a)

Za izmene samo u JS/TS kodu (ekrani, logika, stilovi):

```powershell
npm run update:apk -- --message "kratak opis izmene"
```

Korisnici sa instaliranim APK-om dobijaju update pri **sledećem pokretanju** aplikacije (automatska provera na startu).

| Šta menjaš | Komanda |
|------------|---------|
| JS/TS, UI, API pozivi | `npm run update:apk` |
| Nova native biblioteka, dozvole, ikona | `npm run build:apk` + nova instalacija |
| `version` u `app.json` (npr. 1.0.0 → 1.1.0) | Novi APK build (menja se `runtimeVersion`) |

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
| Obaveštenja | Prvi login / push | Dozvole → Obaveštenja |
| Avantura / GPS | Započni avanturu | Dozvole → Lokacija + Fizička aktivnost |
| GPS ruta | Započni akciju | Dozvole → Lokacija |
| Mapa avantura | Istraži → Mapa | `EXPO_PUBLIC_MAPTILER_API_KEY` u `.env` (isti kao web) |
| Slike | Avatar, cover, akcije | Dozvole → Slike |

## Dijeljenje test korisnicima

Pošalji im **isti APK link** ili fajl. Svaki Android korisnik instalira isto kao gore.

## Napomene

- Render free tier: prvi login nakon pauze može trajati 30–60 s.
- Za Google Play kasnije koristi `eas build -p android --profile production` (AAB, ne APK).
