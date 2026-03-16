import fs from 'node:fs/promises'

import { test, expect } from '@playwright/test'

test.describe('Smoke test', () => {
  test('loads app, interacts with controls, and exports SVG', async ({
    page,
  }) => {
    await page.goto('/')

    // 1. Wait for the app to render — canvas should be visible
    const canvas = page.getByTestId('sketch-canvas')
    await canvas.waitFor({ state: 'visible', timeout: 10_000 })

    // 2. Verify the sketch selector lists at least one sketch
    const sidebar = page.getByTestId('sidebar-left')
    await expect(
      sidebar.locator('button', { hasText: 'Concentric Circles' }),
    ).toBeVisible()

    // 3. Verify the canvas has non-zero dimensions
    const box = await canvas.boundingBox()
    expect(box).toBeTruthy()
    if (!box) return // narrows type for TS without non-null assertion
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)

    // 4. Change the "count" parameter via Leva's number input.
    //    Leva renders inputs with id matching the param key (e.g. id="count").
    //    Inputs are type="text"; Leva commits on Enter press.
    const countField = page.locator('#count')
    await countField.waitFor({ state: 'visible', timeout: 5_000 })
    await countField.fill('10')
    await countField.press('Enter')

    // Wait for the rAF-based render cycle to complete (two frames:
    // one for the app's scheduleRender, one for React's commit)
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    )

    // 5. Export SVG — intercept the download
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export SVG' }).click()
    const download = await downloadPromise

    // 6. Validate SVG content
    const filePath = await download.path()
    expect(filePath).toBeTruthy()
    const svgContent = await fs.readFile(filePath!, 'utf-8')

    // Verify it's a valid SVG with polylines
    expect(svgContent).toContain('<svg')
    expect(svgContent).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svgContent).toContain('<polyline')

    // Verify width/height attributes have values with units (e.g. width="21.59cm")
    expect(svgContent).toMatch(/width="[\d.]+\w+"/)
    expect(svgContent).toMatch(/height="[\d.]+\w+"/)

    // Verify the parameter change took effect (count=10 → 10 polylines)
    const polylineCount = (svgContent.match(/<polyline/g) || []).length
    expect(polylineCount).toBeGreaterThanOrEqual(10)
  })
})
