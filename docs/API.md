# Beleg API — vodič za web i mobile klijente

Jedan Go backend (`/api/*`) za web (Vite) i React Native (Expo). Payload shape je stabilan; breaking promene nisu planirane bez verzionisanja.

## Base URL

| Klijent | Env varijabla | Primer |
|---------|---------------|--------|
| Web | `VITE_API_URL` | `https://api.example.com` |
| Mobile (Expo) | `EXPO_PUBLIC_API_URL` | `https://api.example.com` |

## Autentifikacija

### Login

`POST /login`

```json
{
  "username": "marko",
  "password": "secret",
  "remember_me": true
}
```

**Odgovor (200):**

```json
{
  "role": "admin",
  "user": {
    "username": "marko",
    "fullName": "Marko Marković",
    "avatar_url": "https://...",
    "klubId": 1
  },
  "token": "<JWT>",
  "profileIncomplete": false,
  "pendingSummitReward": null
}
```

### Načini slanja tokena

1. **Bearer (preporučeno za mobile):** `Authorization: Bearer <token>`
2. **Cookie (web):** HttpOnly `auth_token` — web koristi `withCredentials: true`

Mobile koristi **samo Bearer** (`withCredentials: false`).

### Bootstrap sesije

`GET /api/me` — vraća trenutnog korisnika ili `401`.

```json
{
  "username": "marko",
  "fullName": "Marko Marković",
  "role": "admin",
  "avatar_url": "https://...",
  "klubId": 1,
  "email": "marko@example.com",
  "email_verified_at": "2025-01-01T00:00:00Z",
  "pol": "M",
  "datum_rodjenja": "1990-05-15"
}
```

### Logout

`POST /api/logout` — briše cookie; mobile treba lokalno obrisati token.

## Superadmin i `X-Club-Id`

Superadmin može „ući u kontekst kluba” slanjem headera:

```
X-Club-Id: 42
```

Web čuva izbor u `localStorage` (`superadmin_club_id`). Shared klijent (`@beleg/shared`) automatski dodaje header kada je `user.role === 'superadmin'` i postoji sačuvan club id.

## Error format

Standardni oblik:

```json
{ "error": "Opis greške na srpskom" }
```

Opcioni kod (postepeno uvodi se u novim endpointima):

```json
{ "error": "Klub je suspendovan", "code": "CLUB_ON_HOLD" }
```

Poznati kodovi:

| Kod | HTTP | Značenje |
|-----|------|----------|
| `CLUB_ON_HOLD` | 403 | Klub na hold-u — korisnik se odjavljuje |
| `PROFILE_INCOMPLETE` | 403 | Profil nije kompletan |
| `FORBIDDEN` | 403 | Nedovoljne privilegije |

Login već može vratiti `code` u error telu.

## Paginacija

Gde postoji `limit` / `offset` query, odgovor uključuje `total`:

```json
{
  "posts": [...],
  "total": 128,
  "limit": 20,
  "offset": 0
}
```

**Podrazumevano:** `limit=20`, `offset=0` (feed, komentari).

## Ključni endpointi (mobile MVP)

| Oblast | Metoda | Putanja |
|--------|--------|---------|
| Auth | POST | `/login` |
| Auth | GET | `/api/me` |
| Auth | POST | `/api/logout` |
| Akcije | GET | `/api/akcije` |
| Akcije | GET | `/api/akcije/:id` |
| Feed | GET | `/api/posts?limit=&offset=` |
| Obaveštenja | GET | `/api/obavestenja` |
| Profil | GET | `/api/korisnici/:idOrUsername` |

## TypeScript klijent

Deljeni paket: `packages/shared` (`@beleg/shared`)

```ts
import { createApiClient, fetchMe, login } from '@beleg/shared'
```

Web wrapper: `src/services/api.ts` (localStorage + cookie).  
Mobile: `AsyncStorage` adapter + `EXPO_PUBLIC_API_URL`.

## CORS

Web origin mora biti u `CORS_ALLOWED_ORIGINS`. Mobile native app ne šalje Origin na isti način — koristi Bearer auth.

## Verzionisanje

Trenutno: rute bez `/api/v1` prefiksa. Buduće verzionisanje će biti dokumentovano ovde pre migracije.
