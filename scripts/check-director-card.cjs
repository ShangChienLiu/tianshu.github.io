#!/usr/bin/env node

const { chromium } = require('playwright')

const executablePath = '/Users/shangchienliu/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'

function assert (condition, message) {
  if (!condition) throw new Error(message)
}

async function inspect (browser, width) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4180/?page=team', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-director-card]')
  const card = page.locator('[data-director-card]')
  await card.scrollIntoViewIfNeeded()
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-director-card] img')
    return image?.complete && image.naturalWidth > 0
  })
  const result = await card.evaluate(element => {
    const cardRect = element.getBoundingClientRect()
    const image = element.querySelector('img')
    const imageRect = image.getBoundingClientRect()
    const text = element.textContent.replace(/\s+/g, ' ').trim()
    return {
      text,
      width: cardRect.width,
      imageWidth: imageRect.width,
      imageHeight: imageRect.height,
      imageNaturalWidth: image.naturalWidth,
      imageObjectFit: getComputedStyle(image).objectFit,
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      clippedText: [...element.querySelectorAll('h3,p,span')].some(item => item.scrollWidth > item.clientWidth + 1 || item.scrollHeight > item.clientHeight + 1)
    }
  })
  await page.screenshot({ path: `/tmp/director-card-${width}.png`, fullPage: false })
  await context.close()
  return result
}

;(async () => {
  const browser = await chromium.launch({ executablePath, headless: true })
  try {
    for (const width of [320, 390, 1280]) {
      const result = await inspect(browser, width)
      assert(result.text.includes('嘉嘉主任'), `${width}px director name is missing`)
      assert(['校務統籌', '親師溝通', '學生關懷'].every(role => result.text.includes(role)), `${width}px director role is incomplete`)
      assert(result.text.includes('統籌課程、師資與班務運作，以細心與耐心照顧每位孩子的學習需求。'), `${width}px director description is incomplete`)
      assert(result.imageNaturalWidth >= 900, `${width}px director portrait is not high resolution`)
      assert(result.imageObjectFit === 'cover', `${width}px director portrait does not preserve its card shape`)
      assert(Math.abs(result.imageWidth - result.imageHeight) <= 2, `${width}px director portrait is distorted`)
      assert(result.scrollWidth <= result.viewportWidth + 1, `${width}px page has horizontal overflow`)
      assert(result.width <= result.viewportWidth, `${width}px director block exceeds the viewport`)
      assert(!result.clippedText, `${width}px director text is clipped`)
      console.log(`${width}px PASS: director profile is complete, square and unclipped`)
    }
  } finally {
    await browser.close()
  }
})().catch(error => {
  console.error(`FAIL: ${error.message}`)
  process.exit(1)
})
