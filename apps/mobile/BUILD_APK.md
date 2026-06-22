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

**Važno:** Stari APK bez `expo-updates` ne može da povuče OTA. Posle ove konfiguracije obavezno instaliraj **novi** APK (versionCode 4+).

## Google Maps (Mapa avantura)

Mapa avantura na Androidu koristi Google Maps SDK. Bez API ključa aplikacija može da se zatvori pri otvaranju mape.

### Jednokratna priprema

1. U [Google Cloud Console](https://console.cloud.google.com/) kreiraj projekat (ili koristi postojeći).
2. Uključi **Maps SDK for Android**.
3. Kreiraj API ključ i ograniči ga na Android aplikaciju sa package name `rs.planiner.app`.
4. U [expo.dev](https://expo.dev) → tvoj projekat → **Environment variables** (ili lokalno u `eas.json`) postavi:
   - `GOOGLE_MAPS_API_KEY` = tvoj ključ

Ključ se ubacuje u native build preko `app.config.ts` → `android.config.googleMaps.apiKey`.

**Važno:** Promena Maps ključa zahteva **novi APK build** (`npm run build:apk`). OTA update ne menja native konfiguraciju.

Posle builda, testiraj: Istraži → Mapa avantura — mapa se otvara bez izbacivanja iz aplikacije.

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
| GPS ruta | Započni akciju | Dozvole → Lokacija |
| Mapa avantura | Istraži → Mapa | Google Maps API ključ u EAS buildu |
| Slike | Avatar, cover, akcije | Dozvole → Slike |

## Dijeljenje test korisnicima

Pošalji im **isti APK link** ili fajl. Svaki Android korisnik instalira isto kao gore.

## Napomene

- Render free tier: prvi login nakon pauze može trajati 30–60 s.
- Za Google Play kasnije koristi `eas build -p android --profile production` (AAB, ne APK).
