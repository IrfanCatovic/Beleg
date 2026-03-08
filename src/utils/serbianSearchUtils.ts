/**
 * Normalizacija za srpsku pretragu: c/č/ć, z/ž, s/š, đ/dj, dž/dz se tretiraju isto.
 * Koristi se i za upit i za tekst koji se pretražuje.
 */
export function normalizeForSerbianSearch(str: string): string {
  if (!str || typeof str !== 'string') return ''
  let s = str.toLowerCase().trim()
  // Redosled: prvo dž → dz, pa đ → dj, da se ne pomeša
  s = s.replace(/dž/g, 'dz')
  s = s.replace(/đ/g, 'dj')
  s = s.replace(/č/g, 'c')
  s = s.replace(/ć/g, 'c')
  s = s.replace(/ž/g, 'z')
  s = s.replace(/š/g, 's')
  return s
}

/**
 * Proverava da li normalizovani tekst sadrži normalizovani upit (za includes).
 */
export function serbianSearchIncludes(text: string, query: string): boolean {
  return normalizeForSerbianSearch(text).includes(normalizeForSerbianSearch(query))
}
