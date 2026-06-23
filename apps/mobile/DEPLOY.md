# Planiner mobile — deploy checklist

## Universal links (iOS + Android)

Deep link kod je u app-u (`planiner://`, `associatedDomains`, `intentFilters`, `parseActionDeepLink.ts`). Da bi `https://www.planiner.com/akcije/:id` otvarao native app, potrebno je:

### 1. Apple App Site Association

Fajl: [`public/.well-known/apple-app-site-association`](../../public/.well-known/apple-app-site-association)

- Zameniti `TEAMID` pravim Apple Team ID-om (Apple Developer → Membership).
- Format: `"appID": "<TEAM_ID>.rs.planiner.app"`
- Deploy na `https://www.planiner.com/.well-known/apple-app-site-association`
- Bez redirecta; preporučen `Content-Type: application/json`

Verifikacija: [Apple App Search Validation Tool](https://search.developer.apple.com/appsearch-validation-tool/)

### 2. Android App Links

Fajl: [`public/.well-known/assetlinks.json`](../../public/.well-known/assetlinks.json)

- Dodati SHA-256 fingerprint iz EAS / Google Play signing certifikata:

```bash
eas credentials -p android
```

- Deploy na `https://www.planiner.com/.well-known/assetlinks.json`

Verifikacija:

```bash
adb shell pm get-app-links rs.planiner.app
```

### 3. Native build

Universal links **ne rade u Expo Go**. Potreban je novi EAS build posle izmene `app.json` ili `.well-known` fajlova:

```bash
cd apps/mobile
eas build --platform all
```

### 4. Env

U `apps/mobile/.env`:

```
EXPO_PUBLIC_WEB_URL=https://www.planiner.com
```

### 5. Ručni test

1. Instaliraj dev/prod build na uređaj.
2. Otvori u browseru: `https://www.planiner.com/akcije/123?inviteToken=...`
3. Tap treba da otvori app na ActionDetail sa tokenom.
4. Custom scheme: `planiner://akcije/123`
