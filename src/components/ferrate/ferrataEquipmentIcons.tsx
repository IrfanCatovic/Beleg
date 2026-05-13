import type { ComponentType, SVGProps } from 'react'
import {
  ArchiveBoxIcon,
  BeakerIcon,
  BoltIcon,
  CameraIcon,
  ClockIcon,
  CloudIcon,
  CubeIcon,
  DevicePhoneMobileIcon,
  FireIcon,
  FlagIcon,
  HandRaisedIcon,
  HeartIcon,
  HomeModernIcon,
  LightBulbIcon,
  LinkIcon,
  LinkSlashIcon,
  MapIcon,
  ShieldCheckIcon,
  SunIcon,
  TruckIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'

/** Eksplicitan map — Vite ne sme da „tree-shake“ dinamičke ključeve iz `import *`. */
const OUTLINE_ICON_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  LinkIcon,
  LinkSlashIcon,
  CubeIcon,
  HandRaisedIcon,
  BoltIcon,
  LightBulbIcon,
  ArchiveBoxIcon,
  BeakerIcon,
  MapIcon,
  DevicePhoneMobileIcon,
  HeartIcon,
  SunIcon,
  CloudIcon,
  FireIcon,
  CameraIcon,
  ClockIcon,
  UserGroupIcon,
  TruckIcon,
  HomeModernIcon,
  FlagIcon,
}

export type IconName = keyof typeof OUTLINE_ICON_MAP

const DEFAULT_ICON: IconName = 'WrenchScrewdriverIcon'

const OUTLINE_ICON_KEYS = Object.keys(OUTLINE_ICON_MAP) as IconName[]

/** Rešava ključ ikone (trim, tačan ključ, pa case-insensitive match na Heroicons imena). */
export function pickEquipmentIconKey(name?: string | null): IconName {
  const raw = (name ?? '').trim()
  if (!raw) return DEFAULT_ICON
  if (OUTLINE_ICON_MAP[raw]) return raw as IconName
  const lower = raw.toLowerCase()
  for (const k of OUTLINE_ICON_KEYS) {
    if (k.toLowerCase() === lower) return k
  }
  return DEFAULT_ICON
}

const SUGGEST_RULES: { pattern: RegExp; icon: IconName }[] = [
  { pattern: /kacig|helmet|štit|stit/i, icon: 'ShieldCheckIcon' },
  { pattern: /rukavic|glove/i, icon: 'HandRaisedIcon' },
  { pattern: /čelič|celic|steel|už|uz|rope|konop|lano/i, icon: 'LinkIcon' },
  { pattern: /karabin|carabin|snap/i, icon: 'LinkSlashIcon' },
  { pattern: /prsluk|harness|vez|sit/i, icon: 'CubeIcon' },
  { pattern: /ček|cek|ice|cep/i, icon: 'BoltIcon' },
  { pattern: /lampe|svetl|headlamp|bater/i, icon: 'LightBulbIcon' },
  { pattern: /ruksak|backpack|torb/i, icon: 'ArchiveBoxIcon' },
  { pattern: /vod|water|flaš|flas/i, icon: 'BeakerIcon' },
  { pattern: /kompas|map|gps|navig/i, icon: 'MapIcon' },
  { pattern: /telefon|phone/i, icon: 'DevicePhoneMobileIcon' },
  { pattern: /apteč|aptec|first.?aid/i, icon: 'HeartIcon' },
  { pattern: /sunč|sunc|naočar|sunglass/i, icon: 'SunIcon' },
  { pattern: /kiš|kis|rain|jacket|jakn/i, icon: 'CloudIcon' },
  { pattern: /štap|stap|walking|trekking pole/i, icon: 'FlagIcon' },
]

export function suggestEquipmentIcon(label: string): IconName {
  const t = label.trim().toLowerCase()
  if (!t) return DEFAULT_ICON
  for (const r of SUGGEST_RULES) {
    if (r.pattern.test(t)) return r.icon
  }
  return DEFAULT_ICON
}

export function resolveOutlineIcon(name: string): ComponentType<SVGProps<SVGSVGElement>> {
  const key = pickEquipmentIconKey(name)
  return OUTLINE_ICON_MAP[key]
}

/**
 * Renderuje ikonu sa `key` da se pri promeni ključa uvek osveži SVG
 * (pouzdano u dev/HMR i sa dinamičkim Heroicons komponentama).
 */
export function FerrataEquipmentGlyph(props: { name?: string | null; className?: string }) {
  const k = pickEquipmentIconKey(props.name)
  const Cmp = OUTLINE_ICON_MAP[k]
  return <Cmp key={k} className={props.className} aria-hidden />
}

export const FERRATA_EQUIPMENT_ICON_OPTIONS: { key: IconName; label: string; tags: string }[] = [
  { key: 'WrenchScrewdriverIcon', label: 'Alat / oprema', tags: 'oprema alat' },
  { key: 'ShieldCheckIcon', label: 'Kaciga / zaštita', tags: 'kaciga helmet zaštita' },
  { key: 'LinkIcon', label: 'Uže / konop', tags: 'uže konop rope' },
  { key: 'CubeIcon', label: 'Prsluk / vez', tags: 'prsluk harness' },
  { key: 'HandRaisedIcon', label: 'Rukavice', tags: 'rukavice gloves' },
  { key: 'BoltIcon', label: 'Čekič / led', tags: 'čekić cepin ice' },
  { key: 'LightBulbIcon', label: 'Lampa', tags: 'lampa svetlo headlamp' },
  { key: 'ArchiveBoxIcon', label: 'Ruksak', tags: 'ruksak backpack' },
  { key: 'BeakerIcon', label: 'Voda', tags: 'voda flaša' },
  { key: 'MapIcon', label: 'Mapa / GPS', tags: 'mapa gps navigacija' },
  { key: 'DevicePhoneMobileIcon', label: 'Telefon', tags: 'telefon mobilni' },
  { key: 'HeartIcon', label: 'Prva pomoć', tags: 'aptečka prva pomoć' },
  { key: 'SunIcon', label: 'Sunce / UV', tags: 'sunce naočare' },
  { key: 'CloudIcon', label: 'Kiša / jakna', tags: 'kiša jakna' },
  { key: 'FireIcon', label: 'Vatra / toplota', tags: 'vatra toplo' },
  { key: 'CameraIcon', label: 'Kamera', tags: 'kamera foto' },
  { key: 'ClockIcon', label: 'Sat / vreme', tags: 'sat vreme' },
  { key: 'UserGroupIcon', label: 'Grupa', tags: 'grupa ljudi' },
  { key: 'TruckIcon', label: 'Prevoz', tags: 'prevoz auto' },
  { key: 'HomeModernIcon', label: 'Smeštaj', tags: 'smeštaj smještaj hotel' },
  { key: 'LinkSlashIcon', label: 'Karabiner / osigurač', tags: 'karabiner snap' },
  { key: 'FlagIcon', label: 'Štapovi / marker', tags: 'štap walking pole' },
]
