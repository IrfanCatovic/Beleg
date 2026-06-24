# Planiner — deploy checklist (web + mobile)

## Universal links — web hosting

Mobilna app i web dele iste `.well-known` fajlove iz [`public/.well-known/`](../public/.well-known/).

| Fajl | Status u repou | Potrebno na produkciji |
|------|----------------|------------------------|
| `apple-app-site-association` | placeholder `TEAMID` | Pravi Apple Team ID |
| `assetlinks.json` | prazan `sha256_cert_fingerprints` | SHA-256 iz EAS / Google Play signing cert |

### Deploy na www.planiner.com

1. Zameniti placeholder vrednosti u `public/.well-known/*`.
2. Deploy Vite build — `public/` se kopira u static output (`.well-known` mora biti dostupan).
3. URL mora biti **bez redirecta**:
   - `https://www.planiner.com/.well-known/apple-app-site-association`
   - `https://www.planiner.com/.well-known/assetlinks.json`
4. Za AASA preporučen `Content-Type: application/json`.

### Credential-i

- **Apple Team ID:** Apple Developer → Membership → zameniti `TEAMID` u AASA (`appID`: `<TEAM_ID>.rs.planiner.app`)
- **Android SHA-256:** `eas credentials -p android` (iz `apps/mobile`)

### Verifikacija

```bash
curl -I https://www.planiner.com/.well-known/apple-app-site-association
adb shell pm get-app-links rs.planiner.app
```

Apple: [App Search Validation Tool](https://search.developer.apple.com/appsearch-validation-tool/)

### Native mobile build

Universal links ne rade u Expo Go. Posle izmene `.well-known` ili `app.json`:

```bash
cd apps/mobile
eas build --platform all
```

Detalji za mobilni env: [`apps/mobile/DEPLOY.md`](apps/mobile/DEPLOY.md).

---

## Web app (Vite)

- `VITE_API_URL` — backend API
- `VITE_MAP_STYLE_URL` / MapTiler ključevi po potrebi
- CORS na backendu mora uključivati tačan URL sajta (`CORS_ORIGINS`)

Build:

```bash
npm run build
```

Proveriti da `dist/.well-known/` postoji posle build-a.

---

## Backend

- SMTP / Resend za email verifikaciju
- `CORS_ORIGINS` uključuje produkcijski web URL
