#!/usr/bin/env node

const { chromium } = require('playwright')

const executablePath = '/Users/shangchienliu/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'

function assert (condition, message) {
  if (!condition) throw new Error(message)
}

async function inspect (browser, width) {
  const context = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:4180/', { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-math-ai-demo]')
  const demo = page.locator('[data-math-ai-demo]')
  await demo.scrollIntoViewIfNeeded()
  await page.waitForTimeout(4200)
  const result = await demo.evaluate((element, viewportWidth) => ({
    width: Math.round(element.getBoundingClientRect().width),
    viewportWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    handwriting: element.querySelector('[data-demo-handwriting]').textContent,
    messages: [...element.querySelectorAll('.math-ai-demo__bubble')].map(item => item.textContent),
    sendState: element.querySelector('[data-demo-send-label]').textContent,
    replayLabel: element.querySelector('[data-demo-replay]').getAttribute('aria-label'),
    liveRegion: element.querySelector('[data-demo-live]').getAttribute('aria-live'),
    topic: element.querySelector('.math-ai-demo__topic').textContent,
    fabHiddenWhileDemoVisible: viewportWidth >= 900 || getComputedStyle(document.querySelector('.om-fab-stack')).opacity === '0',
    clippedText: [...element.querySelectorAll('.math-ai-demo__bubble')].some(item => item.scrollHeight > item.clientHeight || item.scrollWidth > item.clientWidth)
  }), width)
  await page.screenshot({ path: `/tmp/math-ai-demo-${width}.png`, fullPage: false })
  await context.close()
  return result
}

;(async () => {
  const browser = await chromium.launch({ executablePath, headless: true })
  try {
    for (const width of [320, 390, 1280]) {
      const result = await inspect(browser, width)
      assert(result.scrollWidth <= result.viewportWidth + 1, `${width}px page has horizontal overflow`)
      assert(result.width <= result.viewportWidth, `${width}px demo exceeds viewport`)
      assert(result.handwriting.includes('2x + 6 = 18'), `${width}px handwriting animation did not run`)
      assert(result.messages.some(text => text.includes('等式兩邊')), `${width}px Socratic AI question did not type`)
      assert(result.messages.some(text => text.includes('減 6')), `${width}px student math response did not type`)
      assert(result.sendState.includes('AI'), `${width}px handwritten work was not sent to AI`)
      assert(result.topic.includes('一元一次方程式'), `${width}px demo is not explicitly a math problem`)
      assert(result.replayLabel === '重新播放教學示範', `${width}px replay control lacks an accessible label`)
      assert(result.liveRegion === 'polite', `${width}px demo lacks a polite live transcript`)
      assert(result.fabHiddenWhileDemoVisible, `${width}px floating contact buttons cover the demo`)
      assert(!result.clippedText, `${width}px chat text is clipped`)
      console.log(`${width}px PASS: handwriting → AI → Socratic question → student response`)
    }
  } finally {
    await browser.close()
  }
})().catch(error => {
  console.error(`FAIL: ${error.message}`)
  process.exit(1)
})
