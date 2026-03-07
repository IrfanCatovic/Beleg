# Korišćenje univerzalnog modala

Modal se koristi preko **React Context-a** – u bilo kojoj komponenti koja je unutar `ModalProvider` (ceo App je već obavijen u `main.tsx`).

## 1. U komponenti: hook

```tsx
import { useModal } from '../context/ModalContext'

export default function NekaStranica() {
  const { showAlert, showConfirm } = useModal()
  // ...
}
```

## 2. Obaveštenje (samo poruka + dugme „U redu”)

Zameni `alert('...')` sa:

```tsx
await showAlert('Uspešno ste se prijavili!')
// ili sa naslovom:
await showAlert('Nema podataka za izveštaj.', 'Godišnji izveštaj')
```

Ako ne čekaš korisnika, možeš i bez `await`: `showAlert('...')`.

## 3. Pitanje Da / Ne (potvrda pre akcije)

Zameni `if (!confirm('...')) return` + dalju logiku sa:

```tsx
const confirmed = await showConfirm('Da li želite da se prijavite za "Planina X"?')
if (!confirmed) return

try {
  await api.post(`/api/akcije/${id}/prijavi`)
  await showAlert('Uspešno!')
} catch (err) {
  await showAlert(err.response?.data?.error || 'Greška.')
}
```

## 4. Opasne akcije (brisanje) – crveno dugme

```tsx
const confirmed = await showConfirm(
  'Da li si siguran da želiš da obrišeš ovu akciju? Ova akcija će biti trajno obrisana.',
  { variant: 'danger', confirmLabel: 'Obriši', cancelLabel: 'Odustani' }
)
if (!confirmed) return
await api.delete(...)
await showAlert('Akcija je uspešno obrisana.')
```

## Gde zameniti u aplikaciji

- **Actions.tsx** – već prebačeno na modal (prijava, otkazivanje, godišnji izveštaj).
- **ActionDetails.tsx** – `handleDelete`, `handleUpdateStatus`, `handleZavrsiAkciju`: zameni `window.confirm` i `alert` sa `showConfirm` / `showAlert` i `useModal()`.
- **Zadaci.tsx** – `handleTakeTask`, `handleZavrsi`, `handleDelete`: isto – `useModal()` pa `showConfirm` / `showAlert`.

Korak po korak: u svakoj od tih stranica dodaj `useModal()`, pa u svakoj funkciji gde piše `confirm(...)` ili `alert(...)` zameni kao u primerima iznad.
