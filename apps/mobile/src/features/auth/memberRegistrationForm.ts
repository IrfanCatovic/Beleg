export interface MemberFormFields {
  username: string
  password: string
  fullName: string
  imeRoditelja: string
  pol: string
  datumRodjenja: string
  drzavljanstvo: string
  adresa: string
  telefon: string
  email: string
  brojLicnogDokumenta: string
  brojPlaninarskeLegitimacije: string
  brojPlaninarskeMarkice: string
  datumUclanjenja: string
  napomene: string
  role?: string
}

export function emptyMemberForm(): MemberFormFields {
  return {
    username: '',
    password: '',
    fullName: '',
    imeRoditelja: '',
    pol: '',
    datumRodjenja: '',
    drzavljanstvo: '',
    adresa: '',
    telefon: '',
    email: '',
    brojLicnogDokumenta: '',
    brojPlaninarskeLegitimacije: '',
    brojPlaninarskeMarkice: '',
    datumUclanjenja: '',
    napomene: '',
    role: '',
  }
}

const usernameCharset = /^[a-zA-Z0-9._]+$/

export function validateMemberForm(
  form: MemberFormFields,
  confirmPassword: string,
): string | null {
  const u = form.username.trim()
  if (u.length < 2 || u.length > 30) return 'Korisničko ime mora imati 2-30 karaktera.'
  if (!usernameCharset.test(u)) return 'Dozvoljena su slova, brojevi, tačka i donja crta.'
  if (form.password.length < 8) return 'Lozinka mora imati najmanje 8 karaktera.'
  if (form.password !== confirmPassword) return 'Lozinke se ne poklapaju.'
  if (!form.email.trim()) return 'Email je obavezan.'
  if (!form.pol.trim()) return 'Pol je obavezan.'
  if (!form.datumRodjenja.trim()) return 'Datum rođenja je obavezan.'
  return null
}

export function buildMemberFormData(
  form: MemberFormFields,
  options?: { inviteCode?: string; klubId?: number; role?: string; avatarUri?: string },
): FormData {
  const fd = new FormData()
  fd.append('username', form.username.trim().toLowerCase())
  fd.append('password', form.password)
  fd.append('role', options?.role ?? 'clan')

  const optional: (keyof MemberFormFields)[] = [
    'fullName', 'imeRoditelja', 'pol', 'datumRodjenja', 'drzavljanstvo',
    'adresa', 'telefon', 'email', 'brojLicnogDokumenta',
    'brojPlaninarskeLegitimacije', 'brojPlaninarskeMarkice', 'datumUclanjenja', 'napomene',
  ]
  for (const key of optional) {
    const val = form[key]?.trim()
    if (val) fd.append(key, val)
  }

  if (options?.inviteCode) fd.append('inviteCode', options.inviteCode)
  if (options?.klubId != null) fd.append('klubId', String(options.klubId))

  if (options?.avatarUri) {
    const name = options.avatarUri.split('/').pop() || 'avatar.jpg'
    fd.append('avatar', { uri: options.avatarUri, name, type: 'image/jpeg' } as unknown as Blob)
  }

  return fd
}
