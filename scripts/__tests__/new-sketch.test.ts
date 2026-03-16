import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { slugify, datePrefix } from '../new-sketch'

const ROOT = join(import.meta.dirname, '..', '..')
const SKETCHES_DIR = join(ROOT, 'sketches')

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('My Sketch')).toBe('my-sketch')
  })

  it('replaces special characters with hyphens', () => {
    expect(slugify('hello@world!!')).toBe('hello-world')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('a---b')).toBe('a-b')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('handles unicode by stripping non-alphanumeric', () => {
    expect(slugify('café résumé')).toBe('caf-r-sum')
  })

  it('returns empty string for all-special-char input', () => {
    expect(slugify('!!@@##')).toBe('')
  })

  it('handles mixed case and numbers', () => {
    expect(slugify('Flow Field 3D')).toBe('flow-field-3d')
  })
})

describe('datePrefix', () => {
  it('returns a YYYY-MM-DD formatted string', () => {
    const result = datePrefix()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches today', () => {
    const d = new Date()
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(datePrefix()).toBe(expected)
  })
})

describe('new-sketch CLI (integration)', () => {
  const testSlug = `${datePrefix()}-cli-test-sketch`
  const testDir = join(SKETCHES_DIR, testSlug)

  beforeEach(() => {
    // Ensure clean slate in case a previous run was interrupted
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  it('creates a sketch directory with index.ts and presets/', () => {
    execSync('pnpm new-sketch -- --name "CLI Test Sketch"', {
      cwd: ROOT,
      stdio: 'pipe',
    })

    expect(existsSync(join(testDir, 'index.ts'))).toBe(true)
    expect(existsSync(join(testDir, 'presets', '.gitkeep'))).toBe(true)
  })

  it('copies the template content', () => {
    execSync('pnpm new-sketch -- --name "CLI Test Sketch"', {
      cwd: ROOT,
      stdio: 'pipe',
    })

    const created = readFileSync(join(testDir, 'index.ts'), 'utf-8')
    const template = readFileSync(
      join(ROOT, 'src', 'template', 'index.ts'),
      'utf-8',
    )
    expect(created).toBe(template)
  })

  it('fails gracefully when sketch already exists', () => {
    // Create the directory first
    mkdirSync(testDir, { recursive: true })

    expect(() =>
      execSync('pnpm new-sketch -- --name "CLI Test Sketch"', {
        cwd: ROOT,
        stdio: 'pipe',
      }),
    ).toThrow()
  })

  it('fails when --name is missing', () => {
    expect(() =>
      execSync('pnpm new-sketch', {
        cwd: ROOT,
        stdio: 'pipe',
      }),
    ).toThrow()
  })

  it('fails when name has no alphanumeric characters', () => {
    expect(() =>
      execSync('pnpm new-sketch -- --name "!!@@##"', {
        cwd: ROOT,
        stdio: 'pipe',
      }),
    ).toThrow()
  })
})
