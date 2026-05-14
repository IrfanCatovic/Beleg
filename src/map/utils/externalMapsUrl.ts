/** Google Maps — tačka na zadatim koordinatama (radi u browseru i u aplikaciji ako je instalirana). */
export function googleMapsPinUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`
}
