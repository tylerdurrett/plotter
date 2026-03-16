/**
 * CLI script to scaffold a new sketch from the template.
 *
 * Usage: pnpm new-sketch -- --name "my sketch name"
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(import.meta.dirname, '..')
const TEMPLATE_PATH = join(ROOT, 'src', 'template', 'index.ts')
const SKETCHES_DIR = join(ROOT, 'sketches')

/** Convert a human-readable name into a URL-safe slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Return a date as YYYY-MM-DD (defaults to today). */
export function datePrefix(d: Date = new Date()): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function parseArgs(argv: string[]): string {
  const idx = argv.indexOf('--name')
  if (idx === -1 || idx + 1 >= argv.length) {
    console.error('Usage: pnpm new-sketch -- --name "sketch name"')
    process.exit(1)
  }
  return argv[idx + 1]
}

function main() {
  const name = parseArgs(process.argv)
  const slug = slugify(name)

  if (!slug) {
    console.error(
      'Error: name must contain at least one alphanumeric character.',
    )
    process.exit(1)
  }

  const dirName = `${datePrefix()}-${slug}`
  const sketchDir = join(SKETCHES_DIR, dirName)

  if (existsSync(sketchDir)) {
    console.error(`Error: sketch already exists at ${sketchDir}`)
    process.exit(1)
  }

  // Create sketch directory and copy template
  mkdirSync(sketchDir, { recursive: true })
  copyFileSync(TEMPLATE_PATH, join(sketchDir, 'index.ts'))

  // Create presets directory with .gitkeep
  const presetsDir = join(sketchDir, 'presets')
  mkdirSync(presetsDir)
  writeFileSync(join(presetsDir, '.gitkeep'), '')

  console.log(sketchDir)
}

// Only run when executed directly (not when imported by tests)
const thisFile = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  main()
}
