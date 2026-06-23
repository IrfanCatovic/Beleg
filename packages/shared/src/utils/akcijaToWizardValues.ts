import type { AkcijaDetail } from '../types/akcija'
import type { WizardValues } from '../types/actionWizard'
import { createEmptyWizardValues } from './wizardDefaults'

export function akcijaToWizardValues(akcija: AkcijaDetail): WizardValues {
  const datumStr =
    typeof akcija.datum === 'string'
      ? akcija.datum.slice(0, 10)
      : new Date(akcija.datum).toISOString().slice(0, 10)
  const rokPrijavaStr = akcija.rokPrijava
    ? new Date(akcija.rokPrijava).toISOString().slice(0, 10)
    : ''
  let vremePolaska = '09:00'
  if (akcija.startAt) {
    const d = new Date(akcija.startAt)
    vremePolaska = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  const tip = akcija.tipAkcije || 'planina'
  const isVia = tip === 'via_ferrata'
  const tezina = (akcija.tezina === 'teško' ? 'tesko' : akcija.tezina) || ''

  return {
    ...createEmptyWizardValues(),
    naziv: akcija.naziv || '',
    actionKind: tip,
    organizerType: akcija.organizatorTip === 'vodic' ? 'vodic' : 'klub',
    visibility: akcija.javna ? 'javna' : 'klubska',
    planina: akcija.planina || '',
    vrh: akcija.vrh || '',
    datum: datumStr,
    vremePolaska,
    ferrataId: akcija.ferrataId ? String(akcija.ferrataId) : '',
    opis: akcija.opis || '',
    tezina,
    kumulativniUsponM: akcija.kumulativniUsponM != null ? String(akcija.kumulativniUsponM) : '',
    duzinaStazeKm: akcija.duzinaStazeKm != null ? String(akcija.duzinaStazeKm) : '',
    visinaVrhM: akcija.visinaVrhM != null ? String(akcija.visinaVrhM) : '',
    zimskiUspon: isVia ? false : (akcija.zimskiUspon ?? false),
    vodicId: akcija.vodicId ? String(akcija.vodicId) : '',
    drugiVodicCheck: !!akcija.drugiVodicIme,
    drugiVodicIme: akcija.drugiVodicIme || '',
    trajanjeSati: akcija.trajanjeSati != null ? String(akcija.trajanjeSati) : '',
    rokPrijava: rokPrijavaStr,
    maxLjudi: akcija.maxLjudi != null ? String(akcija.maxLjudi) : '',
    mestoPolaska: isVia ? '' : akcija.mestoPolaska || '',
    kontaktTelefon: akcija.kontaktTelefon || '',
    brojDana: isVia ? '1' : akcija.brojDana != null ? String(akcija.brojDana) : '1',
    cenaClan: akcija.cenaClan != null ? String(akcija.cenaClan) : '',
    cenaOstali: akcija.cenaOstali != null ? String(akcija.cenaOstali) : '',
    prikaziListuPrijavljenih: akcija.prikaziListuPrijavljenih ?? true,
    omoguciGrupniChat: akcija.omoguciGrupniChat ?? false,
    planinaLat: '',
    planinaLng: '',
    smestaj: isVia
      ? []
      : (akcija.smestaj ?? []).map((s) => ({
          localId: `s-${s.id}`,
          naziv: s.naziv || '',
          cenaPoOsobiUkupno: String(s.cenaPoOsobiUkupno || 0),
          opis: s.opis || '',
        })),
    oprema: isVia
      ? []
      : (akcija.opremaRent ?? []).map((o) => ({
          localId: `o-${o.id}`,
          naziv: o.nazivOpreme || '',
          dostupnaKolicina: String(o.dostupnaKolicina || 0),
          cenaPoSetu: String(o.cenaPoSetu || 0),
        })),
    prevoz: isVia
      ? []
      : (akcija.prevoz ?? []).map((p) => ({
          localId: `p-${p.id}`,
          tipPrevoza: p.tipPrevoza || '',
          nazivGrupe: p.nazivGrupe || '',
          kapacitet: String(p.kapacitet || 0),
          cenaPoOsobi: String(p.cenaPoOsobi || 0),
        })),
  }
}
