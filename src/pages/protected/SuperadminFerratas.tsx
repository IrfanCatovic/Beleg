import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import { FerrataLocationEditor } from '../../components/ferrate/FerrataLocationEditor'
import { DynamicTextRows } from '../../components/ferrate/DynamicTextRows'
import { FerrataOpremaForm, type OpremaFormRow } from '../../components/ferrate/FerrataOpremaForm'
import { FerrataSmestajForm, type SmestajFormRow } from '../../components/ferrate/FerrataSmestajForm'
import { FerrataGalleryEditor } from '../../components/ferrate/FerrataGalleryEditor'
import { pickEquipmentIconKey, suggestEquipmentIcon } from '../../components/ferrate/ferrataEquipmentIcons'

type FerrataRow = Record<string, unknown> & { id: number; naziv: string; slug: string; status: string }

type ContactRow = { id: number; ime: string; telefon?: string; whatsapp?: string; email?: string; napomena?: string }

function emptyForm() {
  return {
    naziv: '',
    slug: '',
    drzava: '',
    gradOpstina: '',
    opis: '',
    tezina: '',
    tezinaOpcija: '',
    duzinaM: 0,
    visinskaRazlikaM: 0,
    trajanjeMin: 0,
    trajanjeMax: 0,
    quickTip: '',
    highlightsRaw: '',
    okolina: [] as string[],
    smestaj: [] as SmestajFormRow[],
    obaveznaOprema: [] as OpremaFormRow[],
    status: 'active',
    lat: '',
    lng: '',
    coverImage: '',
    mapNote: '',
    gallery: [] as string[],
  }
}

function galerijaFromApi(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x).trim()).filter(Boolean)
}

function okolinaFromApi(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x).trim()).filter(Boolean)
}

function smestajFromApi(raw: unknown): SmestajFormRow[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => {
    const r = x as Record<string, unknown>
    const slike = Array.isArray(r.slike) ? (r.slike as unknown[]).filter((u): u is string => typeof u === 'string') : []
    return {
      naziv: String(r.naziv ?? ''),
      opis: String(r.opis ?? ''),
      lat: r.lat != null && Number.isFinite(Number(r.lat)) ? String(r.lat) : '',
      lng: r.lng != null && Number.isFinite(Number(r.lng)) ? String(r.lng) : '',
      slike,
    }
  })
}

function obaveznaFromApi(raw: unknown): OpremaFormRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => {
      if (typeof x === 'string') {
        const label = String(x).trim()
        return { label, icon: suggestEquipmentIcon(label) }
      }
      const o = x as { label?: string; icon?: string }
      const label = String(o.label ?? '').trim()
      if (!label) return { label: '', icon: 'WrenchScrewdriverIcon' }
      const iconRaw = (o.icon ?? '').trim()
      const icon = iconRaw ? pickEquipmentIconKey(iconRaw) : suggestEquipmentIcon(label)
      return { label, icon }
    })
    .filter((r) => r.label.trim())
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
  const [contactForm, setContactForm] = useState({ ime: '', telefon: '', whatsapp: '', email: '', napomena: '' })
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
      setContactForm({ ime: '', telefon: '', whatsapp: '', email: '', napomena: '' })
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

  function mapOptionalCoord(s: string): number | null {
    const t = s.trim().replace(',', '.')
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }

  function coordToFormField(v: unknown): string {
    if (v == null || v === '') return ''
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    return String(v)
  }

  async function handleSave() {
    setErr('')
    const highlights = parseList(form.highlightsRaw)
    const la = mapOptionalCoord(form.lat)
    const lo = mapOptionalCoord(form.lng)
    if ((la == null) !== (lo == null)) {
      setErr('Unesi obe koordinate ferate (lat i lng) ili obe ostavi prazne.')
      return
    }
    const smestajDto: {
      naziv: string
      opis: string
      slike: string[]
      lat: number | null
      lng: number | null
    }[] = []
    for (const s of form.smestaj) {
      if (!s.naziv.trim() && !s.opis.trim() && s.slike.length === 0 && !s.lat.trim() && !s.lng.trim()) continue
      const sla = mapOptionalCoord(s.lat)
      const slo = mapOptionalCoord(s.lng)
      if ((sla == null) !== (slo == null)) {
        setErr(`Smeštaj „${s.naziv.trim() || 'bez naziva'}”: unesi obe koordinate ili obe prazne.`)
        return
      }
      smestajDto.push({
        naziv: s.naziv.trim(),
        opis: s.opis.trim(),
        slike: s.slike,
        lat: sla,
        lng: slo,
      })
    }
    const obavezna = form.obaveznaOprema
      .filter((o) => o.label.trim())
      .map((o) => ({ label: o.label.trim(), icon: o.icon.trim() || 'WrenchScrewdriverIcon' }))
    const payload = {
      naziv: form.naziv,
      slug: form.slug,
      drzava: form.drzava,
      gradOpstina: form.gradOpstina,
      opis: form.opis,
      tezina: form.tezina,
      tezinaOpcija: form.tezinaOpcija,
      duzinaM: Number(form.duzinaM) || 0,
      visinskaRazlikaM: Number(form.visinskaRazlikaM) || 0,
      trajanjeMin: Number(form.trajanjeMin) || 0,
      trajanjeMax: Number(form.trajanjeMax) || 0,
      quickTip: form.quickTip,
      highlights,
      okolina: form.okolina.map((s) => s.trim()).filter(Boolean),
      smestaj: smestajDto,
      obaveznaOprema: obavezna,
      coverImage: form.coverImage,
      status: form.status,
      lat: la,
      lng: lo,
      mapNote: form.mapNote.trim().slice(0, 800),
      galerija: form.gallery.map((u) => u.trim()).filter(Boolean),
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
    setForm({
      naziv: String(row.naziv ?? ''),
      slug: String(row.slug ?? ''),
      drzava: String(row.drzava ?? ''),
      gradOpstina: String(row.gradOpstina ?? ''),
      opis: String(row.opis ?? ''),
      tezina: String(row.tezina ?? ''),
      tezinaOpcija: String(row.tezinaOpcija ?? ''),
      duzinaM: Number(row.duzinaM ?? 0),
      visinskaRazlikaM: Number(row.visinskaRazlikaM ?? 0),
      trajanjeMin: Number(row.trajanjeMin ?? 0),
      trajanjeMax: Number(row.trajanjeMax ?? 0),
      quickTip: String(row.quickTip ?? ''),
      highlightsRaw: h,
      okolina: okolinaFromApi(row.okolina),
      smestaj: smestajFromApi(row.smestaj),
      obaveznaOprema: obaveznaFromApi(row.obaveznaOprema),
      coverImage: String(row.coverImage ?? ''),
      status: String(row.status ?? 'active'),
      lat: coordToFormField(row.lat),
      lng: coordToFormField(row.lng),
      mapNote: String(row.mapNote ?? ''),
      gallery: galerijaFromApi(row.galerija),
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
        whatsapp: contactForm.whatsapp.trim(),
        email: contactForm.email.trim(),
        napomena: contactForm.napomena.trim(),
      })
      setContactForm({ ime: '', telefon: '', whatsapp: '', email: '', napomena: '' })
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
      const res = await api.post<{ coverImage?: string }>(`/api/superadmin/ferratas/${id}/cover`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url = res.data?.coverImage
      if (editingId === id && url) setForm((f) => ({ ...f, coverImage: url }))
      await load()
    } catch {
      setErr('Upload slike nije uspeo.')
    }
  }

  const inp = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm'

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
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
          <input className={inp} placeholder="Grad / opština (za prikaz regiona)" value={form.gradOpstina} onChange={(e) => setForm({ ...form, gradOpstina: e.target.value })} />
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
          <input className={inp} type="number" placeholder="Trajanje min" value={form.trajanjeMin || ''} onChange={(e) => setForm({ ...form, trajanjeMin: Number(e.target.value) })} />
          <input className={inp} type="number" placeholder="Trajanje max" value={form.trajanjeMax || ''} onChange={(e) => setForm({ ...form, trajanjeMax: Number(e.target.value) })} />
          <select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="active">active</option>
            <option value="closed">closed</option>
            <option value="archived">archived</option>
          </select>
        </div>
        <p className="text-xs font-semibold text-gray-700 pt-2">{t('superadminSectionContent')}</p>
        <textarea className={inp} rows={4} placeholder="Opis (O ferati)" value={form.opis} onChange={(e) => setForm({ ...form, opis: e.target.value })} />
        <textarea className={inp} rows={3} placeholder="Highlights — Zašto ići? (jedan po liniji)" value={form.highlightsRaw} onChange={(e) => setForm({ ...form, highlightsRaw: e.target.value })} />
        <textarea className={inp} rows={2} placeholder={t('superadminQuickTip')} value={form.quickTip} onChange={(e) => setForm({ ...form, quickTip: e.target.value })} />

        <p className="text-xs font-semibold text-gray-700 pt-2">Šta još u okolini</p>
        <DynamicTextRows
          values={form.okolina}
          onChange={(okolina) => setForm((prev) => ({ ...prev, okolina }))}
          placeholder="Npr. vidikovac, reka, manastir…"
          addLabel="Dodaj stavku"
        />

        <p className="text-xs font-semibold text-gray-700 pt-2">Obavezna oprema</p>
        <FerrataOpremaForm rows={form.obaveznaOprema} onChange={(obaveznaOprema) => setForm((prev) => ({ ...prev, obaveznaOprema }))} />

        <p className="text-xs font-semibold text-gray-700 pt-2">Smeštaj (slike na Cloudinary posle čuvanja ID ferate)</p>
        <FerrataSmestajForm
          rows={form.smestaj}
          onChange={(smestaj) => setForm((prev) => ({ ...prev, smestaj }))}
          ferrataId={editingId}
          onUploadError={(msg) => setErr(msg)}
        />

        {editingId && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
            <p className="text-xs font-bold text-emerald-900 mb-2">Cover slika (Cloudinary)</p>
            {form.coverImage ? <img src={form.coverImage} alt="" className="mb-2 h-32 w-full max-w-xs rounded-lg object-cover ring-1 ring-emerald-200" /> : null}
            <input type="file" accept="image/*" className="text-xs" onChange={(e) => void uploadCover(editingId, e.target.files?.[0] ?? null)} />
          </div>
        )}

        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <p className="text-xs font-bold text-gray-800 mb-2">{t('superadminGalleryTitle')}</p>
          <FerrataGalleryEditor
            urls={form.gallery}
            onChange={(gallery) => setForm((prev) => ({ ...prev, gallery }))}
            ferrataId={editingId}
            onUploadError={(msg) => setErr(msg)}
          />
        </div>

        <FerrataLocationEditor
          key={editingId ?? 'new'}
          lat={form.lat}
          lng={form.lng}
          onLatChange={(lat) => setForm((prev) => ({ ...prev, lat }))}
          onLngChange={(lng) => setForm((prev) => ({ ...prev, lng }))}
        />
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">{t('mapNoteLabel')}</label>
          <textarea
            className={inp}
            rows={3}
            value={form.mapNote}
            onChange={(e) => setForm({ ...form, mapNote: e.target.value })}
            placeholder="Npr. iz Ribarića putem asfaltnog puta do parkinga, zatim 25 min peske markerisanom stazom…"
          />
        </div>

        {editingId && (
          <div className="border-t border-gray-100 pt-4 mt-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Vodiči (ručni unos)</h3>
            {contacts.length === 0 ? (
              <p className="text-xs text-gray-500">{t('superadminContactsEmpty')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {contacts.map((c) => (
                  <li key={c.id} className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
                    <span className="font-semibold text-gray-900">{c.ime}</span>
                    {c.telefon && <span className="text-gray-600"> · {c.telefon}</span>}
                    {c.whatsapp && <span className="text-gray-600"> · WA {c.whatsapp}</span>}
                    {c.email && <span className="text-gray-600"> · {c.email}</span>}
                    {c.napomena && <p className="text-xs text-gray-500 mt-0.5">{c.napomena}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                placeholder="WhatsApp"
                value={contactForm.whatsapp}
                onChange={(e) => setContactForm({ ...contactForm, whatsapp: e.target.value })}
              />
              <input
                className={inp}
                type="email"
                placeholder="Email"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              />
              <input
                className={`${inp} sm:col-span-2 lg:col-span-1`}
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
              <th className="px-4 py-2">Mapa</th>
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
                <td className="px-4 py-2 text-center" title="lat/lng">
                  {r.lat != null && r.lng != null ? '●' : '—'}
                </td>
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
