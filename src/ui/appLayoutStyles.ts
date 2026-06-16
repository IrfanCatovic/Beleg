export const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative px-3.5 py-1.5 text-[13px] font-semibold tracking-wide rounded-lg transition-all duration-200 ${
    isActive
      ? 'bg-white/[0.08] text-white'
      : 'text-white/70 hover:text-white hover:bg-white/[0.05]'
  }`

export function navDropdownTriggerClass(open: boolean, routeActive: boolean) {
  const on = open || routeActive
  return `inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold tracking-wide transition-all duration-200 ${
    on ? 'bg-white/[0.1] text-white shadow-inner shadow-black/20' : 'text-white/70 hover:text-white hover:bg-white/[0.06]'
  }`
}

export const navDropdownPanelClass =
  'absolute left-0 top-full z-50 mt-1.5 min-w-[14.5rem] rounded-xl border border-white/10 bg-slate-900/97 py-1 shadow-2xl ring-1 ring-black/30 backdrop-blur-xl'

export const navDropdownLinkClass =
  'flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium text-white/90 hover:bg-white/[0.08] transition-colors'

export const navDropdownSoonClass =
  'flex w-full cursor-not-allowed items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] font-medium text-white/45 select-none'

export const mobileExploreSoonClass =
  'flex cursor-not-allowed items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-white/45 select-none'

export const canSeeFinance = (role?: string) =>
  role === 'superadmin' || role === 'admin' || role === 'blagajnik'

export const iconBtnClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-emerald-400/40 transition-all duration-200'
