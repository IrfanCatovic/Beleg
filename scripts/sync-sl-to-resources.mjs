/**
 * Replaces the inlined `sl` object in resources.ts with the contents of locales/sl.json.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const resourcesPath = path.join(root, 'src', 'i18n', 'resources.ts')
const slPath = path.join(root, 'src', 'i18n', 'locales', 'sl.json')

const r = fs.readFileSync(resourcesPath, 'utf8')
const slBody = fs.readFileSync(slPath, 'utf8').trim()
const start = r.indexOf('\n  sl: {')
if (start === -1) throw new Error('Could not find start of sl block (\\n  sl: {)')

const afterPrefix = r.slice(start + '\n  sl: '.length)
let depth = 0
let i = 0
for (; i < afterPrefix.length; i++) {
  const c = afterPrefix[i]
  if (c === '{') depth++
  else if (c === '}') {
    depth--
    if (depth === 0) {
      i++
      break
    }
  }
}
const tail = afterPrefix.slice(i)
const newR = r.slice(0, start) + '\n  sl: ' + slBody + tail
fs.writeFileSync(resourcesPath, newR, 'utf8')
console.log('Synced sl.json → resources.ts')
