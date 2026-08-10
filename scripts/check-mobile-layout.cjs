#!/usr/bin/env node

const { chromium } = require('playwright')

const executablePath = '/Users/shangchienliu/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'

async function inspectNavigation (page, url, selector) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector(selector)
  return page.locator(selector).evaluate(nav => {
    const viewportWidth = document.documentElement.clientWidth
    const items = [...nav.children].map(item => {
      const rect = item.getBoundingClientRect()
      return { text: item.textContent.trim(), left: rect.left, right: rect.right }
    })
    return {
      viewportWidth,
      clientWidth: nav.clientWidth,
      scrollWidth: nav.scrollWidth,
      clippedItems: items.filter(item => item.left < -0.5 || item.right > viewportWidth + 0.5)
    }
  })
}

async function main () {
  const browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()

  const home = await inspectNavigation(page, 'http://127.0.0.1:4180/', '.om-nav')
  const vispo = await inspectNavigation(page, 'http://127.0.0.1:4180/vispo/', '.nav')
  const cta = await page.locator('.mobile-cta').evaluate(element => {
    const rect = element.getBoundingClientRect()
    const viewportWidth = document.documentElement.clientWidth
    return {
      width: rect.width,
      height: rect.height,
      rightGap: viewportWidth - rect.right,
      left: rect.left
    }
  })
  await browser.close()

  console.log(`home_nav=${JSON.stringify(home)}`)
  console.log(`vispo_nav=${JSON.stringify(vispo)}`)
  console.log(`vispo_mobile_cta=${JSON.stringify(cta)}`)

  for (const [name, result] of [['home', home], ['vispo', vispo]]) {
    if (result.scrollWidth > result.clientWidth + 1 || result.clippedItems.length) {
      throw new Error(`${name} navigation has clipped or horizontally hidden items`)
    }
  }
  if (cta.width > 72 || cta.height > 72 || Math.abs(cta.width - cta.height) > 1) {
    throw new Error('Vispo mobile CTA is not a compact circle')
  }
  if (cta.rightGap < 8 || cta.rightGap > 24 || cta.left < 390 / 2) {
    throw new Error('Vispo mobile CTA is not anchored at the lower-right corner')
  }
  console.log('PASS: mobile navigation and Vispo CTA fit without covering content')
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
})
