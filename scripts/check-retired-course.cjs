#!/usr/bin/env node

const assert = require('node:assert/strict')
const { chromium } = require('playwright')

const executablePath = '/Users/shangchienliu/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'
const baseURL = 'http://127.0.0.1:4180'
const routes = ['/', '/story/', '/team/', '/contact/', '/win/']

async function main () {
  const browser = await chromium.launch({ executablePath, headless: true })
  try {
    for (const width of [390, 1280]) {
      for (const javaScriptEnabled of [false, true]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled })
        const page = await context.newPage()
        for (const route of routes) {
          const response = await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' })
          assert.equal(response.status(), 200, `${route} must remain accessible`)
          if (javaScriptEnabled && route !== '/win/') await page.waitForSelector('#dc-root')
          if (width < 900) await page.locator('header details summary').click()
          const result = await page.evaluate(() => ({
            text: document.body.innerText,
            retiredLinks: document.querySelectorAll('a[href*="/vispo"], a[href="#vispo"]').length,
            width: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            winLinks: document.querySelectorAll('header a[href="/win/"]').length
          }))
          assert(!/vispo|矽谷|診斷暨體驗日|體驗診斷日|8\/29/i.test(result.text), `${route} ${width}px still promotes the retired course`)
          assert.equal(result.retiredLinks, 0, `${route} still links to the retired course`)
          assert.equal(result.winLinks, 2, `${route} must keep desktop and mobile Win navigation`)
          assert(result.scrollWidth <= result.width + 1, `${route} ${width}px overflows`)
        }
        await context.close()
      }
    }
    const page = await browser.newPage()
    for (const route of ['/vispo/', '/vispo/vispo-math-experiment.jpg']) {
      const response = await page.goto(`${baseURL}${route}`)
      assert.equal(response.status(), 404, `${route} must no longer be published`)
    }
  } finally {
    await browser.close()
  }
  console.log('PASS: all pages and mobile menus omit the retired course before and after interactivity; its page and poster are unpublished')
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
})
