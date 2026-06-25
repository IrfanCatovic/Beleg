# Planiner (Beleg)

Monorepo za upravljanje planinarskim klubovima: akcije, članovi, finansije, ferate, vodiči, mape.

## Struktura

| Deo | Tehnologija | Folder |
|-----|-------------|--------|
| Frontend | React 19, TypeScript, Vite, Tailwind | `src/` |
| Backend | Go, Gin, GORM | `backend/` |
| Baza | PostgreSQL | — |

## Lokalni razvoj

### Preduslovi

- Node.js 20+
- Go 1.25+
- PostgreSQL

### Backend

```bash
cd backend
cp .env.example .env   # popuni vrednosti lokalno — ne commituj .env
go run .
```

Server sluša na `http://localhost:8080`.

### Frontend

```bash
npm install
npm run dev
```

Vite dev server (`http://localhost:5173`) proxy-uje API na backend.

## Env varijable

Vidi [`backend/.env.example`](backend/.env.example) i [`.env.example`](.env.example). **Nikad ne commituj prave `.env` fajlove.**

## Build

```bash
npm run build          # frontend → dist/
cd backend && go build # backend binary
```

## Debug vodiči

Prostim jezikom — gde je šta u kodu i šta proveriti kad nešto ne radi:

| Deo | Fajl |
|-----|------|
| Backend (Go API) | [`backend/DEBUG.md`](backend/DEBUG.md) |
| Web (React) | [`src/DEBUG.md`](src/DEBUG.md) |
| Mobile (Expo) | [`apps/mobile/DEBUG.md`](apps/mobile/DEBUG.md) |
| Shared (zajednički kod) | [`packages/shared/DEBUG.md`](packages/shared/DEBUG.md) |
