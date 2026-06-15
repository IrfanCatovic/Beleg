/** Bedž težine ferate za mapu i kartice. */
export function difficultyBadgeClass(tezina: string) {
  const s = (tezina || '').toUpperCase()
  if (s.includes('E')) return 'bg-zinc-900 text-white border-zinc-800 shadow-zinc-900/20'
  if (s.includes('D')) return 'bg-rose-600 text-white border-rose-700 shadow-rose-600/25'
  if (s.includes('C')) return 'bg-amber-500 text-white border-amber-600 shadow-amber-500/25'
  if (s.includes('B')) return 'bg-sky-600 text-white border-sky-700 shadow-sky-600/25'
  if (s.includes('A')) return 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-600/25'
  return 'bg-slate-600 text-white border-slate-700 shadow-slate-600/20'
}
