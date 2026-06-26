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

**Važno:** Stari APK bez `expo-updates` ne može da povuče OTA. Posle ove konfiguracije obavezno instaliraj **novi** APK (versionCode 8+).

## Započni avanturu (GPS + stiker)

Na tabu **Istraži** kartica **Započni avanturu** pokreće praćenje koraka, km, vremena i uspona. Ruta se crta na kraju; **stiker** se otvara dugmetom na završnom ekranu.

Za **čuvanje stikera u galeriju** i PNG export potreban je APK sa `react-native-view-shot` i `expo-media-library` (versionCode 7+).

**Pozadinsko praćenje (versionCode 8+):** dok je avantura aktivna, app može biti minimizovan — GPS i timer nastavljaju (Android foreground notifikacija). Ako se app potpuno ugasi iz recent apps, sesija se automatski prekida.

## Dnevni koraci (iOS + Android)

- **iOS:** koraci se čitaju iz Core Motion pri svakom otvaranju app-a.
- **Android:** koristi **Health Connect** (mora biti instaliran na Samsung/Google uređajima). Pri prvom uključivanju brojača dozvoli **Fizička aktivnost** i **Health Connect → Koraci**.
- Pozadinski sync (`expo-background-fetch`) periodično šalje korake na server.

Za punu funkcionalnost dnevnih koraka na Androidu obavezan je **novi APK** (versionCode 8+) sa `react-native-health-connect`.

## Push obaveštenja (expo-notifications)

Poslovna obaveštenja (zadaci, akcije, klub, follow, finansije…) treba da stižu **na telefon u notifikacionoj traci**, čak i kad je app ugašena.

**Ako vidiš obaveštenje tek kad otvoriš app** (npr. „pre 20 min”) — to **nije push**. App tada samo učitava listu sa servera. Push na Androidu **ne radi** dok ne podesiš Firebase (FCM) ispod.

### Zašto treba Firebase (FCM)?

Android push ide ovim putem:

```
Server → Expo → Google (FCM) → tvoj telefon
```

Bez Firebase ključeva, Google ne zna kuda da pošalje poruku na tvoj telefon. Obaveštenje se ipak sačuva u bazi — zato ga vidiš kad uđeš u app.

### Jednokratna priprema (~15 min)

#### Korak A — Firebase projekat

1. Otvori [Firebase Console](https://console.firebase.google.com/) → **Add project** (ili koristi postojeći).
2. **Add app** → **Android**.
3. **Android package name:** `rs.planiner.app` (mora tačno ovako).
4. Preuzmi **`google-services.json`**.
5. Za **lokalni** build: stavi fajl u `apps/mobile/google-services.json` (pored `app.json`).
6. Za **EAS cloud build** (fajl ne ide u git): upload na Expo:
   ```powershell
   cd apps\mobile
   npx eas env:create --name GOOGLE_SERVICES_JSON --type file --value .\google-services.json --environment preview --visibility secret
   ```
   Ponovi sa `--environment production` ako koristiš production profil.

#### Korak B — FCM ključ na Expo (ovo je „tačka 3”)

1. U Firebase: **Project settings** → **Service accounts** → **Generate new private key** → preuzmi JSON (čuvaj ga, ne deli javno).
2. Otvori [expo.dev](https://expo.dev) → projekat **beleg-mobile** → **Project settings** → **Credentials**.
3. Android → identifier `rs.planiner.app` → **FCM V1 service account key** → **Upload** → izaberi taj JSON → **Save**.

Alternativa iz terminala (`apps/mobile`):

```powershell
eas credentials
```

→ Android → Google Service Account → Upload service account key for FCM V1.

#### Korak C — Novi APK i dozvola na telefonu

1. **Obavezno** posle koraka A i B:
   ```powershell
   npm run build:apk
   ```
   (Build **neće proći** dok nema `google-services.json` lokalno **ili** `GOOGLE_SERVICES_JSON` na EAS-u.)
2. Instaliraj novi APK (versionCode 9+).
3. Pri logovanju dozvoli **Obaveštenja** (Android pita pri prvom putu).
4. Deploy backend-a na Render (da server šalje push sa `priority: high`).

### Provera da li radi

1. Uloguj se na telefonu, dozvoli obaveštenja.
2. **Potpuno ugasi** app (povuci iz recent apps).
3. Sa drugog naloga pošalji follow zahtev ili neko drugo obaveštenje.
4. Treba da vidiš poruku u **Android traci** za par sekundi — bez otvaranja app-a.

Ako i dalje ne stiže: u Expo Credentials proveri da je FCM V1 key uploadovan, i da je `google-services.json` u buildu (novi APK posle dodavanja fajla).

**Novi native modul** zahteva **novi APK build** (`npm run build:apk`). Posle toga, izmene samo u JS mogu preko OTA.

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
| JS/TS, UI, API pozivi (Faza 1–2) | `npm run update:apk` |
| Health Connect, background GPS, nove dozvole | `npm run build:apk` + nova instalacija (versionCode 8+) |
| `version` u `app.json` (npr. 1.0.0 → 1.1.0) | Novi APK build (menja se `runtimeVersion`) |

## QA matrica (pre distribucije)

| Scenario | Očekivanje |
|----------|------------|
| Korisnik bez kluba → Akcije | Vidi javne klupske i vodičke aktivne akcije |
| Stop avanture | Završni ekran sa statistikom; stiker na dugme; nema logout/crash |
| Avantura minimizovana 10+ min | Timer i GPS nastavljaju (notifikacija na Androidu) |
| Avantura ubijena iz recent | Sesija prekinuta; poruka pri sledećem otvaranju |
| Dnevni koraci, app ubijen | iOS: tačan broj pri otvaranju; Android: Health Connect čitanje |
| Prijava na javnu akciju bez kluba | Zahtev za prijavu poslat |

## Instalacija na Samsung

1. Preuzmi APK na telefon (link iz builda ili prebaci fajl).
2. Otvori fajl → dozvoli **„Instalacija nepoznatih aplikacija”** za Chrome/fajl menadžer ako traži.
3. Instaliraj **Planiner**.
4. Pri prvom korišćenju:
   - **Dnevni koraci** → tapni **„Omogući brojač koraka”** → Dozvoli (Fizička aktivnost) + Health Connect koraci.
   - **Započni avanturu** → dozvola za **Lokaciju** (uvek i u pozadini).
   - **Profil / slike** → dozvola za **Slike** (galerija).

## Dozvole u aplikaciji

| Funkcija | Kada se pita | Android postavka |
|----------|--------------|------------------|
| Koraci | Kartica Dnevni koraci | Fizička aktivnost + Health Connect → Koraci |
| Obaveštenja | Prvi login / push | Dozvole → Obaveštenja |
| Avantura / GPS | Započni avanturu | Lokacija (uvek + u pozadini) |
| Avantura u pozadini | Minimizovan app | Foreground notifikacija „Planiner avantura” |
| Mapa avantura | Istraži → Mapa | `EXPO_PUBLIC_MAPTILER_API_KEY` u `.env` |
| Slike | Avatar, cover, akcije | Dozvole → Slike |

## Dijeljenje test korisnicima

Pošalji im **isti APK link** ili fajl. Svaki Android korisnik instalira isto kao gore.

## Napomene

- Render free tier: prvi login nakon pauze može trajati 30–60 s.
- Za Google Play kasnije koristi `eas build -p android --profile production` (AAB, ne APK).
