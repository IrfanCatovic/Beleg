import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

type FerrataRow = Record<string, unknown> & { id: number; naziv: string; slug: string; status: string }

function emptyForm() {
  return {
    naziv: '',
    slug: '',
    drzava: '',
    gradOpstina: '',
    lokacija: '',
    kratakOpis: '',
    opis: '',
    tezina: '',
    tezinaOpcija: '',
    duzinaM: 0,
    visinskaRazlikaM: 0,
    prilazMin: 0,
    trajanjeMin: 0,
    trajanjeMax: 0,
    pogodnoZaPocetnike: '',
    highlightsRaw: '',
    obaveznaRaw: '',
    coverImage: '/ferrate/djurdjevica-hero.png',
    status: 'active',
  }
}

export default function SuperadminFerratas() {
  const { t } = useTranslation('ferrate')
  const { user } = useAuth()
  const [rows, setRows] = useState<FerrataRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await api.get('/api/superadmin/ferratas')
      setRows((res.data?.ferrate as FerrataRow[]) ?? [])
    } catch {
      setErr('Greška pri učitavanju.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (!user || user.role !== 'superadmin') {
    return <p className="p-6 text-sm text-gray-600">Nemate pristup.</p>
  }

  function parseList(raw: string): string[] {
    return raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  async function handleSave() {
    setErr('')
    const highlights = parseList(form.highlightsRaw)
    const obaveznaOprema = parseList(form.obaveznaRaw)
    const payload = {
      naziv: form.naziv,
      slug: form.slug,
      drzava: form.drzava,
      gradOpstina: form.gradOpstina,
      lokacija: form.lokacija,
      kratakOpis: form.kratakOpis,
      opis: form.opis,
      tezina: form.tezina,
      tezinaOpcija: form.tezinaOpcija,
      duzinaM: Number(form.duzinaM) || 0,
      visinskaRazlikaM: Number(form.visinskaRazlikaM) || 0,
      prilazMin: Number(form.prilazMin) || 0,
      trajanjeMin: Number(form.trajanjeMin) || 0,
      trajanjeMax: Number(form.trajanjeMax) || 0,
      pogodnoZaPocetnike: form.pogodnoZaPocetnike,
      highlights,
      obaveznaOprema,
      coverImage: form.coverImage,
      status: form.status,
    }
    try {
      if (editingId) {
        await api.put(`/api/superadmin/ferratas/${editingId}`, payload)
      } else {
        await api.post('/api/superadmin/ferratas', payload)
      }
      setEditingId(null)
      setForm(emptyForm())
      await load()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(msg || 'Greška pri čuvanju.')
    }
  }

  function startEdit(row: FerrataRow) {
    setEditingId(row.id as number)
    const h = Array.isArray(row.highlights) ? (row.highlights as string[]).join('\n') : ''
    const o = Array.isArray(row.obaveznaOprema) ? (row.obaveznaOprema as string[]).join('\n') : ''
    setForm({
      naziv: String(row.naziv ?? ''),
      slug: String(row.slug ?? ''),
      drzava: String(row.drzava ?? ''),
      gradOpstina: String(row.gradOpstina ?? ''),
      lokacija: String(row.lokacija ?? ''),
      kratakOpis: String(row.kratakOpis ?? ''),
      opis: String(row.opis ?? ''),
      tezina: String(row.tezina ?? ''),
      tezinaOpcija: String(row.tezinaOpcija ?? ''),
      duzinaM: Number(row.duzinaM ?? 0),
      visinskaRazlikaM: Number(row.visinskaRazlikaM ?? 0),
      prilazMin: Number(row.prilazMin ?? 0),
      trajanjeMin: Number(row.trajanjeMin ?? 0),
      trajanjeMax: Number(row.trajanjeMax ?? 0),
      pogodnoZaPocetnike: String(row.pogodnoZaPocetnike ?? ''),
      highlightsRaw: h,
      obaveznaRaw: o,
      coverImage: String(row.coverImage ?? ''),
      status: String(row.status ?? 'active'),
    })
  }

  async function uploadCover(id: number, file: File | null) {
    if (!file) return
    const fd = new FormData()
    fd.append('slika', file)
    try {
      await api.post(`/api/superadmin/ferratas/${id}/cover`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await load()
    } catch {
      setErr('Upload slike nije uspeo.')
    }
  }

  const inp = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-gray-900">{t('superadminTitle')}</h1>
        <Link to="/superadmin" className="text-sm font-semibold text-emerald-700 hover:underline">
          ← Superadmin
        </Link>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">…</p>}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">{editingId ? `Uredi #${editingId}` : t('superadminAdd')}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={inp} placeholder="Naziv" value={form.naziv} onChange={(e) => setForm({ ...form, naziv: e.target.value })} />
          <input className={inp} placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <input className={inp} placeholder="Država" value={form.drzava} onChange={(e) => setForm({ ...form, drzava: e.target.value })} />
          <input className={inp} placeholder="Grad/opština" value={form.gradOpstina} onChange={(e) => setForm({ ...form, gradOpstina: e.target.value })} />
          <input className={inp} placeholder="Lokacija" value={form.lokacija} onChange={(e) => setForm({ ...form, lokacija: e.target.value })} />
          <input className={inp} placeholder="Cover URL" value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} />
          <input className={inp} placeholder="Težina" value={form.tezina} onChange={(e) => setForm({ ...form, tezina: e.target.value })} />
          <input className={inp} placeholder="Teža opcija" value={form.tezinaOpcija} onChange={(e) => setForm({ ...form, tezinaOpcija: e.target.value })} />
          <input className={inp} type="number" placeholder="Dužina m" value={form.duzinaM || ''} onChange={(e) => setForm({ ...form, duzinaM: Number(e.target.value) })} />
          <input
            className={inp}
            type="number"
            placeholder="Vis. razlika m"
            value={form.visinskaRazlikaM || ''}
            onChange={(e) => setForm({ ...form, visinskaRazlikaM: Number(e.target.value) })}
          />
          <input className={inp} type="number" placeholder="Prilaz min" value={form.prilazMin || ''} onChange={(e) => setForm({ ...form, prilazMin: Number(e.target.value) })} />
          <input className={inp} type="number" placeholder="Trajanje min" value={form.trajanjeMin || ''} onChange={(e) => setForm({ ...form, trajanjeMin: Number(e.target.value) })} />
          <input className={inp} type="number" placeholder="Trajanje max" value={form.trajanjeMax || ''} onChange={(e) => setForm({ ...form, trajanjeMax: Number(e.target.value) })} />
          <input className={inp} placeholder="Pogodno (npr. uz_vodica)" value={form.pogodnoZaPocetnike} onChange={(e) => setForm({ ...form, pogodnoZaPocetnike: e.target.value })} />
          <select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">active</option>
            <option value="closed">closed</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <textarea className={inp} rows={2} placeholder="Kratak opis" value={form.kratakOpis} onChange={(e) => setForm({ ...form, kratakOpis: e.target.value })} />
        <textarea className={inp} rows={4} placeholder="Opis" value={form.opis} onChange={(e) => setForm({ ...form, opis: e.target.value })} />
        <textarea className={inp} rows={3} placeholder="Highlights (jedan po liniji)" value={form.highlightsRaw} onChange={(e) => setForm({ ...form, highlightsRaw: e.target.value })} />
        <textarea className={inp} rows={2} placeholder="Oprema (jedan po liniji)" value={form.obaveznaRaw} onChange={(e) => setForm({ ...form, obaveznaRaw: e.target.value })} />
        <div className="flex gap-2">
          <button type="button" onClick={() => void handleSave()} className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2">
            Sačuvaj
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setForm(emptyForm())
            }}
            className="rounded-xl border border-gray-200 text-sm font-semibold px-4 py-2"
          >
            Otkaži
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Naziv</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Cover</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{r.id}</td>
                <td className="px-4 py-2 font-medium">{r.naziv}</td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2">
                  <input type="file" accept="image/*" className="text-xs" onChange={(e) => void uploadCover(r.id, e.target.files?.[0] ?? null)} />
                </td>
                <td className="px-4 py-2 text-right">
                  <button type="button" className="text-emerald-700 font-semibold" onClick={() => startEdit(r)}>
                    {t('superadminEdit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && !loading && <p className="p-4 text-sm text-gray-500">{t('superadminListEmpty')}</p>}
      </div>
    </div>
  )
}
