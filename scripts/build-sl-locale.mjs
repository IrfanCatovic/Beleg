/**
 * Builds src/i18n/locales/sl.json from tmp-en-i18n.json (run tsx export first).
 * Uses google-translate-api-x; requires network. Preserves {{mustache}} placeholders.
 */
import { translate } from 'google-translate-api-x'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const enPath = path.join(root, 'tmp-en-i18n.json')
const outPath = path.join(root, 'src', 'i18n', 'locales', 'sl.json')

function protectMustache(s) {
  const parts = []
  const out = s.replace(/\{\{[^}]+\}\}/g, (m) => {
    const i = parts.length
    parts.push(m)
    return `⟦${i}⟧`
  })
  return { out, parts }
}

function restoreMustache(s, parts) {
  return s.replace(/⟦(\d+)⟧/g, (_, i) => parts[Number(i)] ?? _)
}

async function translateString(text) {
  const { out, parts } = protectMustache(text)
  const res = await translate(out, { from: 'en', to: 'sl' })
  return restoreMustache(res.text, parts)
}

function collectStrings(obj, set) {
  if (typeof obj === 'string') set.add(obj)
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((v) => collectStrings(v, set))
}

function applyMap(obj, map) {
  if (typeof obj === 'string') return map.get(obj) ?? obj
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const out = {}
    for (const [k, v] of Object.entries(obj)) out[k] = applyMap(v, map)
    return out
  }
  return obj
}

async function main() {
  if (!fs.existsSync(enPath)) {
    console.error('Missing tmp-en-i18n.json. Run: npx tsx -e "import { resources } from \'./src/i18n/resources.ts\'; ..."')
    process.exit(1)
  }
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
  const unique = new Set()
  collectStrings(en, unique)
  const list = [...unique].sort((a, b) => a.length - b.length)
  console.log('Unique strings:', list.length)

  const map = new Map()
  const concurrency = 6
  for (let i = 0; i < list.length; i += concurrency) {
    const batch = list.slice(i, i + concurrency)
    console.log(`Translating ${i + 1}–${i + batch.length} / ${list.length}`)
    await Promise.all(
      batch.map(async (s) => {
        try {
          const t = s.trim() === '' ? s : await translateString(s)
          map.set(s, t)
        } catch (e) {
          console.warn('Retry:', s.slice(0, 50), e.message)
          await new Promise((r) => setTimeout(r, 2500))
          map.set(s, await translateString(s))
        }
      }),
    )
    await new Promise((r) => setTimeout(r, 400))
  }

  const sl = applyMap(en, map)

  // Language picker labels (Slovenian exonyms / standard names)
  sl.common = sl.common || {}
  sl.common.language = 'Jezik'
  sl.common.languageShort = 'SL'
  sl.common.languages = {
    sr: 'Srbščina',
    bs: 'Bosanščina',
    hr: 'Hrvaščina',
    de: 'Nemščina',
    en: 'Angleščina',
    sl: 'Slovenščina',
  }
  sl.common.appName = 'Planiner'

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(sl, null, 2), 'utf8')
  console.log('Wrote', outPath)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
