import type { WizardImagePayload, WizardValues } from '../types/actionWizard'

export function buildActionWizardFormData(values: WizardValues, image?: WizardImagePayload): FormData {
  const formData = new FormData()
  formData.append('naziv', values.naziv)
  formData.append('planina', values.planina.trim())
  formData.append('vrh', values.vrh)
  formData.append('datum', values.datum)
  if (values.actionKind === 'via_ferrata') {
    formData.append('ferrataId', values.ferrataId.trim())
    formData.append('startAt', `${values.datum}T${values.vremePolaska.trim()}`)
    formData.append('brojDana', '1')
    formData.append('mestoPolaska', '')
    formData.append('zimskiUspon', 'false')
    formData.append('visinaVrhM', '0')
  }
  formData.append('opis', values.opis)
  formData.append('tezina', values.tezina)
  formData.append('kumulativniUsponM', values.kumulativniUsponM)
  formData.append('duzinaStazeKm', values.duzinaStazeKm)
  formData.append('visinaVrhM', values.visinaVrhM)
  formData.append('zimskiUspon', String(values.zimskiUspon))
  formData.append('javna', String(values.visibility === 'javna'))
  formData.append('organizatorTip', values.organizerType)
  formData.append('tipAkcije', values.actionKind)
  if (values.actionKind === 'planina') {
    formData.append('planinaLat', values.planinaLat.trim())
    formData.append('planinaLng', values.planinaLng.trim())
    formData.append('trajanjeSati', values.trajanjeSati)
  }
  formData.append('rokPrijava', values.rokPrijava)
  formData.append('maxLjudi', values.maxLjudi)
  formData.append('mestoPolaska', values.mestoPolaska)
  formData.append('kontaktTelefon', values.kontaktTelefon)
  formData.append('brojDana', values.brojDana)
  const cenaClan = values.cenaClan
  const cenaOstali = values.actionKind === 'via_ferrata' ? cenaClan : values.cenaOstali
  formData.append('cenaClan', cenaClan)
  formData.append('cenaOstali', cenaOstali)
  formData.append('prikaziListuPrijavljenih', String(values.prikaziListuPrijavljenih))
  formData.append('omoguciGrupniChat', 'false')
  if (values.vodicId) formData.append('vodic_id', values.vodicId)
  if (values.drugiVodicCheck && values.drugiVodicIme.trim()) {
    formData.append('drugi_vodic_ime', values.drugiVodicIme.trim())
  }
  if (values.actionKind !== 'via_ferrata' && image) {
    if (image instanceof File) {
      formData.append('slika', image)
    } else if (image && 'uri' in image) {
      formData.append('slika', image as unknown as Blob)
    }
  }

  formData.append(
    'smestajJson',
    JSON.stringify(
      values.smestaj
        .filter((s) => s.naziv.trim())
        .map((s) => ({
          naziv: s.naziv.trim(),
          cenaPoOsobiUkupno: Number(s.cenaPoOsobiUkupno || 0),
          opis: s.opis.trim(),
        })),
    ),
  )
  formData.append(
    'opremaJson',
    JSON.stringify(
      values.oprema
        .filter((o) => o.naziv.trim())
        .map((o) => ({
          naziv: o.naziv.trim(),
          dostupnaKolicina: Number(o.dostupnaKolicina || 0),
          cenaPoSetu: Number(o.cenaPoSetu || 0),
        })),
    ),
  )
  formData.append(
    'prevozJson',
    JSON.stringify(
      values.prevoz
        .filter((p) => p.tipPrevoza.trim() && p.nazivGrupe.trim())
        .map((p) => ({
          tipPrevoza: p.tipPrevoza.trim(),
          nazivGrupe: p.nazivGrupe.trim(),
          kapacitet: Number(p.kapacitet || 0),
          cenaPoOsobi: Number(p.cenaPoOsobi || 0),
        })),
    ),
  )

  return formData
}
