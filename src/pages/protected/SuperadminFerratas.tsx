import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

type FerrataRow = Record<string, unknown> & { id: number; naziv: string; slug: string; status: string }

type ContactRow = { id: number; ime: string; telefon?: string; napomena?: string }

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
    parkingInfo: '',
    povratakInfo: '',
    najboljeVremeInfo: '',
    quickTip: '',
    whoBeginnersText: '',
    whoRecreationalText: '',
    whoExperiencedText: '',
    highlightsRaw: '',
    obaveznaRaw: '',
    coverImage: '',
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
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [contactForm, setContactForm] = useState({ ime: '', telefon: '', napomena: '' })
  const [contactSaving, setContactSaving] = useState(false)

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

  const loadContactsForEdit = useCallback(async (fid: number) => {
    try {
      const res = await api.get(`/api/ferratas/${fid}/contacts`)
      setContacts((res.data?.contacts as ContactRow[]) ?? [])
    } catch {
      setContacts([])
    }
  }, [])

  useEffect(() => {
    if (!editingId) {
      setContacts([])
      setContactForm({ ime: '', telefon: '', napomena: '' })
      return
    }
    void loadContactsForEdit(editingId)
  }, [editingId, loadContactsForEdit])

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
      parkingInfo: form.parkingInfo,
      povratakInfo: form.povratakInfo,
      najboljeVremeInfo: form.najboljeVremeInfo,
      quickTip: form.quickTip,
      whoBeginnersText: form.whoBeginnersText,
      whoRecreationalText: form.whoRecreationalText,
      whoExperiencedText: form.whoExperiencedText,
      highlights,
      obaveznaOprema,
      coverImage: form.coverImage,
      status: form.status,
    }
    try {
      if (editingId) {
        await api.put(`/api/superadmin/ferratas/${editingId}`, payload)
        await load()
        await loadContactsForEdit(editingId)
      } else {
        const res = await api.post<{ ferrata?: FerrataRow }>('/api/superadmin/ferratas', payload)
        const fer = res.data?.ferrata
        await load()
        if (fer && typeof fer.id === 'number') {
          startEdit(fer)
        } else {
          setEditingId(null)
          setForm(emptyForm())
        }
      }
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
      parkingInfo: String(row.parkingInfo ?? ''),
      povratakInfo: String(row.povratakInfo ?? ''),
      najboljeVremeInfo: String(row.najboljeVremeInfo ?? ''),
      quickTip: String(row.quickTip ?? ''),
      whoBeginnersText: String(row.whoBeginnersText ?? ''),
      whoRecreationalText: String(row.whoRecreationalText ?? ''),
      whoExperiencedText: String(row.whoExperiencedText ?? ''),
      highlightsRaw: h,
      obaveznaRaw: o,
      coverImage: String(row.coverImage ?? ''),
      status: String(row.status ?? 'active'),
    })
  }

  async function handleAddContact() {
    if (!editingId) return
    const ime = contactForm.ime.trim()
    if (!ime) {
      setErr('Ime kontakta je obavezno.')
      return
    }
    setErr('')
    setContactSaving(true)
    try {
      await api.post(`/api/superadmin/ferratas/${editingId}/contacts`, {
        ime,
        telefon: contactForm.telefon.trim(),
        napomena: contactForm.napomena.trim(),
      })
      setContactForm({ ime: '', telefon: '', napomena: '' })
      await loadContactsForEdit(editingId)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(msg || 'Greška pri dodavanju kontakta.')
    } finally {
      setContactSaving(false)
    }
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900">{t('superadminTitle')}</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setEditingId(null)
              setForm(emptyForm())
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="rounded-xl bg-emerald-600 text-white text-sm font-semibold px-4 py-2 hover:bg-emerald-700"
          >
            {t('superadminAdd')}
          </button>
          <Link to="/superadmin" className="text-sm font-semibold text-emerald-700 hover:underline">
            ← Superadmin
          </Link>
        </div>
      </div>
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {loading && <p className="text-sm text-gray-500">…</p>}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">{editingId ? `Uredi #${editingId}` : t('superadminAdd')}</h2>
        <p className="text-xs text-gray-500">{t('superadminSectionCatalog')}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={inp} placeholder="Naziv" value={form.naziv} onChange={(e) => setForm({ ...form, naziv: e.target.value })} />
          <input className={inp} placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <input className={inp} placeholder="Država" value={form.drzava} onChange={(e) => setForm({ ...form, drzava: e.target.value })} />
          <input className={inp} placeholder="Grad/opština" value={form.gradOpstina} onChange={(e) => setForm({ ...form, gradOpstina: e.target.value })} />
          <input className={inp} placeholder="Lokacija" value={form.lokacija} onChange={(e) => setForm({ ...form, lokacija: e.target.value })} />
          <input className={inp} placeholder="Cover URL (opciono; ili upload posle čuvanja)" value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} />
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
          <input className={inp} placeholder="Pogodno za početnike" value={form.pogodnoZaPocetnike} onChange={(e) => setForm({ ...form, pogodnoZaPocetnike: e.target.value })} />
          <select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">active</option>
            <option value="closed">closed</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <p className="text-[11px] text-gray-500">{t('superadminHintPogodno')}</p>
        <p className="text-xs font-semibold text-gray-700 pt-2">{t('superadminSectionContent')}</p>
        <textarea className={inp} rows={2} placeholder="Kratak opis" value={form.kratakOpis} onChange={(e) => setForm({ ...form, kratakOpis: e.target.value })} />
        <textarea className={inp} rows={4} placeholder="Opis (O ferati)" value={form.opis} onChange={(e) => setForm({ ...form, opis: e.target.value })} />
        <textarea className={inp} rows={3} placeholder="Highlights — Zašto ići? (jedan po liniji)" value={form.highlightsRaw} onChange={(e) => setForm({ ...form, highlightsRaw: e.target.value })} />
        <textarea className={inp} rows={2} placeholder="Obavezna oprema (jedan po liniji)" value={form.obaveznaRaw} onChange={(e) => setForm({ ...form, obaveznaRaw: e.target.value })} />
        <textarea className={inp} rows={2} placeholder={t('superadminQuickTip')} value={form.quickTip} onChange={(e) => setForm({ ...form, quickTip: e.target.value })} />

        <p className="text-xs font-semibold text-gray-700 pt-2">{t('superadminSectionLogistics')}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={inp} placeholder={t('superadminParking')} value={form.parkingInfo} onChange={(e) => setForm({ ...form, parkingInfo: e.target.value })} />
          <input className={inp} placeholder={t('superadminReturn')} value={form.povratakInfo} onChange={(e) => setForm({ ...form, povratakInfo: e.target.value })} />
          <input className={`${inp} sm:col-span-2`} placeholder={t('superadminBestSeason')} value={form.najboljeVremeInfo} onChange={(e) => setForm({ ...form, najboljeVremeInfo: e.target.value })} />
        </div>

        <p className="text-xs font-semibold text-gray-700 pt-2">{t('superadminSectionAudience')}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className={inp} placeholder={t('superadminWhoBeginners')} value={form.whoBeginnersText} onChange={(e) => setForm({ ...form, whoBeginnersText: e.target.value })} />
          <input className={inp} placeholder={t('superadminWhoRecreational')} value={form.whoRecreationalText} onChange={(e) => setForm({ ...form, whoRecreationalText: e.target.value })} />
          <input className={`${inp} sm:col-span-2`} placeholder={t('superadminWhoExperienced')} value={form.whoExperiencedText} onChange={(e) => setForm({ ...form, whoExperiencedText: e.target.value })} />
        </div>

        {editingId && (
          <div className="border-t border-gray-100 pt-4 mt-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">{t('superadminContactsTitle')}</h3>
            {contacts.length === 0 ? (
              <p className="text-xs text-gray-500">{t('superadminContactsEmpty')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {contacts.map((c) => (
                  <li key={c.id} className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
                    <span className="font-semibold text-gray-900">{c.ime}</span>
                    {c.telefon && <span className="text-gray-600"> · {c.telefon}</span>}
                    {c.napomena && <p className="text-xs text-gray-500 mt-0.5">{c.napomena}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="grid sm:grid-cols-3 gap-2">
              <input
                className={inp}
                placeholder={t('superadminContactName')}
                value={contactForm.ime}
                onChange={(e) => setContactForm({ ...contactForm, ime: e.target.value })}
              />
              <input
                className={inp}
                placeholder={t('superadminContactPhone')}
                value={contactForm.telefon}
                onChange={(e) => setContactForm({ ...contactForm, telefon: e.target.value })}
              />
              <input
                className={inp}
                placeholder={t('superadminContactNote')}
                value={contactForm.napomena}
                onChange={(e) => setContactForm({ ...contactForm, napomena: e.target.value })}
              />
            </div>
            <button
              type="button"
              disabled={contactSaving}
              onClick={() => void handleAddContact()}
              className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm font-semibold px-4 py-2 hover:bg-emerald-100 disabled:opacity-50"
            >
              {t('superadminContactAdd')}
            </button>
          </div>
        )}

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
                <td className="px-4 py-2 font-medium">
                  <span className="block">{r.naziv}</span>
                  <Link to={`/ferate/${String(r.slug)}`} className="text-[11px] font-semibold text-emerald-700 hover:underline" target="_blank" rel="noreferrer">
                    {t('superadminPublicPage')} →
                  </Link>
                </td>
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
