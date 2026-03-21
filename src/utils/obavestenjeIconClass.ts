/**
 * Boje ikonice zvonca po tipu obaveštenja.
 * Post (lajk, komentar, pomen…) — topla pink nijansa (pozitivna društvena energija), ne siva.
 */
export function obavestenjeBellIconClass(type: string): string {
  switch (type) {
    case 'uplata':
      return 'bg-emerald-100 text-emerald-600'
    case 'akcija':
      return 'bg-blue-100 text-blue-600'
    case 'zadatak':
      return 'bg-amber-100 text-amber-700'
    case 'post':
      return 'bg-pink-100 text-pink-600'
    case 'broadcast':
      return 'bg-violet-100 text-violet-600'
    case 'subskripcija':
      return 'bg-amber-100 text-amber-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}
