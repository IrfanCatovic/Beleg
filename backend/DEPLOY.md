# Backend API — deploy checklist

Go + Gin API (`backend/`). Za web/mobile universal links vidi root [`DEPLOY.md`](../DEPLOY.md).

## Obavezni env

| Promenljiva | Opis |
|-------------|------|
| `JWT_SECRET` | Min. 32 karaktera |
| `DATABASE_URL` | Postgres DSN (ili `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `DB_SSLMODE`, `DB_TIMEZONE`) |
| `GIN_MODE` | `release` u produkciji |
| `APP_ENV` | `production` (alternativa za release mode) |

## CORS i cookies

| Promenljiva | Opis |
|-------------|------|
| `ALLOWED_ORIGINS` | Zarezom odvojeni origin-i (npr. `https://www.planiner.com`) |
| `COOKIE_SECURE` | `true` u produkciji (HTTPS) |
| `COOKIE_SAMESITE_NONE` | `true` ako je frontend na drugom domenu od API-ja |

## Email

- **Resend (preporuka):** `RESEND_API_KEY`, opciono `RESEND_FROM`
- **SMTP:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `EMAIL_TO`

## Cloudinary

`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## Health checks

| Endpoint | Svrha |
|----------|--------|
| `GET /health` | Liveness — `{"ok":true}` |
| `GET /ready` | Readiness — ping baze |

Podesiti Railway/load balancer health check na `/health` ili `/ready`.

## Single-instance napomena

Rate limiting (`middleware/rate_limit.go`) i login lockout (`middleware/login_guard.go`) koriste **in-memory** mape. Sa više replika limiti nisu deljeni — koristiti jednu instancu ili uvesti Redis (P2).

## Šema baze

### Dev (podrazumevano)

`AUTO_MIGRATE` nije postavljen ili je `true` → GORM `AutoMigrate` na startu.

### Produkcija

```bash
AUTO_MIGRATE=false
```

Pokrenuti migracije pre starta:

```bash
cd backend
migrate -path migrations -database "$DATABASE_URL" up
```

Baseline migracija: [`migrations/000001_baseline.up.sql`](migrations/000001_baseline.up.sql) — prazan fajl koji dokumentuje da je šema usklađena pre uvođenja migrate alata; nove izmene dodavati kao `000002_*.sql`.

## Background jobs

- Cloudinary pending deletes (24h)
- Subscription hold/warning (6h)

## Verifikacija posle deploy-a

```bash
curl -s https://your-api.example.com/health
curl -s https://your-api.example.com/ready
```
