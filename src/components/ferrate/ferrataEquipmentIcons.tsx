import * as Outline from '@heroicons/react/24/outline'
import type { ComponentType, SVGProps } from 'react'

export type IconName = keyof typeof Outline

const DEFAULT_ICON: IconName = 'WrenchScrewdriverIcon'

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
  const key = (name || '').trim() as IconName
  const C = (Outline as Record<string, ComponentType<SVGProps<SVGSVGElement>>>)[key]
  if (C && typeof C === 'function') return C
  return Outline[DEFAULT_ICON]
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
]
