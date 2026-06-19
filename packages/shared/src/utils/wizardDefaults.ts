import type { ActionKind, OrganizerKind, VisibilityKind, WizardValues } from '../types/actionWizard'

export function createEmptyWizardValues(
  tip: ActionKind = 'planina',
  fromBooking = false,
): WizardValues {
  const organizerType: OrganizerKind = fromBooking ? 'vodic' : 'klub'
  const visibility: VisibilityKind = 'klubska'

  return {
    naziv: '',
    actionKind: tip,
    organizerType,
    visibility,
    planina: '',
    vrh: '',
    datum: '',
    vremePolaska: '09:00',
    ferrataId: '',
    opis: '',
    tezina: '',
    kumulativniUsponM: '',
    duzinaStazeKm: '',
    visinaVrhM: '',
    zimskiUspon: false,
    vodicId: '',
    drugiVodicCheck: false,
    drugiVodicIme: '',
    trajanjeSati: '',
    rokPrijava: '',
    maxLjudi: '',
    mestoPolaska: '',
    kontaktTelefon: '',
    brojDana: '1',
    cenaClan: '',
    cenaOstali: '',
    prikaziListuPrijavljenih: true,
    omoguciGrupniChat: false,
    planinaLat: '',
    planinaLng: '',
    smestaj: [],
    oprema: [],
    prevoz: [],
  }
}
