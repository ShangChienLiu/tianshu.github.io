#!/usr/bin/env node

const { chromium } = require('playwright')

async function main () {
  const browser = await chromium.launch({
    executablePath: '/Users/shangchienliu/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell',
    headless: true
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))

  // Model a LINE WebView where HTML paints before the deferred local runtime,
  // then the external React dependencies arrive later still.
  await page.route('http://127.0.0.1:4180/assets/dc-runtime.js*', async route => {
    await new Promise(resolve => setTimeout(resolve, 500))
    await route.continue()
  })
  await page.route('https://unpkg.com/**', async route => {
    await new Promise(resolve => setTimeout(resolve, 1200))
    await route.continue()
  })

  await page.addInitScript(() => {
    window.__paintSamples = []
    const sample = now => {
      const text = document.body ? document.body.innerText : ''
      window.__paintSamples.push({
        now,
        hero: text.includes('天書難懂'),
        textLength: text.trim().length,
        hasStaticRoot: Boolean(document.querySelector('x-dc')),
        hasInteractiveRoot: Boolean(document.querySelector('#dc-root'))
      })
      if (now < 6000) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })

  await page.goto('http://127.0.0.1:4180/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#dc-root', { timeout: 10000 })
  await page.waitForTimeout(250)

  const samples = await page.evaluate(() => window.__paintSamples)
  await page.getByRole('button', { name: '品牌故事' }).first().click()
  await page.getByText('教育理念與核心價值').waitFor()
  await page.getByRole('button', { name: '師資團隊' }).first().click()
  await page.getByText('Winwin 老師').waitFor()
  await browser.close()

  const firstVisible = samples.findIndex(sample => sample.hero)
  const firstInteractive = samples.findIndex(sample => sample.hasInteractiveRoot && sample.hero)
  const blankAfterVisible = samples.findIndex((sample, index) => (
    index > firstVisible && index < firstInteractive && !sample.hero
  ))

  console.log(`samples=${samples.length}`)
  console.log(`first_visible_sample=${firstVisible}`)
  console.log(`first_interactive_sample=${firstInteractive}`)
  console.log(`blank_after_visible_sample=${blankAfterVisible}`)
  console.log(`page_errors=${pageErrors.length}`)

  if (firstVisible < 0 || firstInteractive < 0) {
    throw new Error('homepage hero did not render in both static and interactive phases')
  }
  if (blankAfterVisible >= 0) {
    throw new Error('homepage became blank between static and interactive rendering')
  }
  if (pageErrors.length) {
    throw new Error(`interactive page raised errors: ${pageErrors.join('; ')}`)
  }
  console.log('PASS: static content stays visible until the interactive view is ready')
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
})
