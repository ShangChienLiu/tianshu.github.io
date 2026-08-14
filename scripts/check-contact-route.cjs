#!/usr/bin/env node

const { chromium } = require('playwright')

const executablePath = '/Users/shangchienliu/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'

function assert (condition, message) {
  if (!condition) throw new Error(message)
}

async function inspectContact (browser, width) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } })
  const page = await context.newPage()
  const response = await page.goto('http://127.0.0.1:4180/contact/', { waitUntil: 'networkidle' })
  await page.waitForSelector('#contact-line')
  const result = await page.evaluate(() => ({
    statusPath: location.pathname,
    title: document.title,
    canonical: document.querySelector('link[rel="canonical"]')?.href,
    heading: document.querySelector('main h1')?.textContent.replace(/\s+/g, ' ').trim(),
    activeTabs: [...document.querySelectorAll('[data-header-target="contact"]')].filter(item => item.getAttribute('aria-current') === 'page').length,
    contactLinks: [...document.querySelectorAll('[data-header-target="contact"]')].map(item => item.getAttribute('href')),
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))
  result.status = response.status()
  await page.screenshot({ path: `/tmp/contact-route-${width}.png`, fullPage: false })
  await context.close()
  return result
}

;(async () => {
  const browser = await chromium.launch({ executablePath, headless: true })
  try {
    for (const width of [320, 390, 1280]) {
      const result = await inspectContact(browser, width)
      assert(result.status === 200, `${width}px /contact/ did not return 200`)
      assert(result.statusPath === '/contact/', `${width}px contact URL was redirected away`)
      assert(result.title === '聯絡我們｜天樞文理補習班', `${width}px contact page title is incorrect`)
      assert(result.canonical === 'https://skybookedu.com/contact/', `${width}px contact canonical URL is incorrect`)
      assert(result.heading === '預約一次學習諮詢', `${width}px contact heading is missing`)
      assert(result.activeTabs >= 1, `${width}px contact tab is not selected`)
      assert(result.contactLinks.every(href => href === '/contact/'), `${width}px contact navigation does not use the independent URL`)
      assert(result.scrollWidth <= result.viewportWidth + 1, `${width}px contact page has horizontal overflow`)
      console.log(`${width}px PASS: /contact/ is independent, selected and unclipped`)
    }

    const context = await browser.newContext({ viewport: { width: 1280, height: 844 } })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4180/', { waitUntil: 'networkidle' })
    await page.locator('.shared-nav [data-header-target="contact"]').click()
    await page.waitForURL('**/contact/')
    assert(new URL(page.url()).pathname === '/contact/', 'homepage contact tab does not navigate to /contact/')

    for (const route of ['/vispo/', '/win/']) {
      await page.goto(`http://127.0.0.1:4180${route}`, { waitUntil: 'networkidle' })
      const hrefs = await page.locator('[data-header-target="contact"]').evaluateAll(items => items.map(item => item.getAttribute('href')))
      assert(hrefs.length >= 2 && hrefs.every(href => href === '/contact/'), `${route} contact navigation does not use /contact/`)
    }

    await page.goto('http://127.0.0.1:4180/?page=contact', { waitUntil: 'networkidle' })
    await page.waitForSelector('#contact-line')
    assert(await page.locator('main h1').innerText().then(text => text.replace(/\s+/g, ' ').trim()) === '預約一次學習諮詢', 'legacy ?page=contact URL no longer works')
    await context.close()
  } finally {
    await browser.close()
  }
  console.log('PASS: contact navigation uses /contact/ and the legacy URL remains compatible')
})().catch(error => {
  console.error(`FAIL: ${error.message}`)
  process.exit(1)
})
