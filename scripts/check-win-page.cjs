#!/usr/bin/env node

const { chromium } = require('playwright')

const executablePath = '/Users/shangchienliu/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'

function assert (condition, message) {
  if (!condition) throw new Error(message)
}

async function inspectViewport (browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))

  await page.goto('http://127.0.0.1:4180/win/', { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach(image => { image.loading = 'eager' })
    const distance = Math.max(240, Math.floor(innerHeight * .75))
    for (let top = 0; top < document.documentElement.scrollHeight; top += distance) {
      scrollTo(0, top)
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    scrollTo(0, document.documentElement.scrollHeight)
  })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(120)
  const state = await page.evaluate(() => {
    const root = document.documentElement
    const hero = document.querySelector('.win-hero')
    const title = document.querySelector('h1')
    const mobileMenu = document.querySelector('.mobile-menu')
    const desktopNav = document.querySelector('.nav')
    const floatingCta = document.querySelector('.mobile-cta')
    const images = [...document.images].map(image => ({
      src: image.currentSrc || image.src,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight
    }))
    const ctaRect = floatingCta?.getBoundingClientRect()
    return {
      viewportWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      heroWidth: hero?.getBoundingClientRect().width ?? 0,
      title: title?.textContent.trim() ?? '',
      titleWidth: title?.getBoundingClientRect().width ?? 0,
      mobileDisplay: mobileMenu ? getComputedStyle(mobileMenu).display : 'missing',
      desktopDisplay: desktopNav ? getComputedStyle(desktopNav).display : 'missing',
      floatingDisplay: floatingCta ? getComputedStyle(floatingCta).display : 'missing',
      floatingCta: ctaRect ? {
        width: ctaRect.width,
        height: ctaRect.height,
        rightGap: root.clientWidth - ctaRect.right
      } : null,
      images,
      hotLabels: [...document.querySelectorAll('.hot-badge')].map(label => label.textContent.trim())
    }
  })

  if (width <= 900) {
    await page.locator('.mobile-menu > summary').click()
    const targets = await page.locator('.mobile-menu-panel a').evaluateAll(links => links.map(link => {
      const rect = link.getBoundingClientRect()
      return { text: link.textContent.trim(), width: rect.width, height: rect.height }
    }))
    await page.mouse.click(8, Math.min(height - 40, 500))
    const closesOutside = await page.locator('.mobile-menu').evaluate(menu => !menu.open)
    assert(targets.every(target => target.height >= 44), `${width}px menu has a touch target under 44px`)
    assert(targets.some(target => target.text.includes('Win珠心算') && target.text.includes('HOT')), `${width}px menu is missing Win珠心算 HOT`)
    assert(closesOutside, `${width}px menu does not close after outside tap`)
  }

  await context.close()
  return { width, state, errors }
}

async function main () {
  const browser = await chromium.launch({ executablePath, headless: true })
  const results = []
  try {
    for (const viewport of [
      { width: 320, height: 740 },
      { width: 390, height: 844 },
      { width: 1280, height: 900 }
    ]) {
      results.push(await inspectViewport(browser, viewport.width, viewport.height))
    }
  } finally {
    await browser.close()
  }

  for (const result of results) {
    const { state } = result
    console.log(`win_${result.width}=${JSON.stringify(state)}`)
    assert(state.scrollWidth <= state.viewportWidth + 1, `${result.width}px page overflows horizontally`)
    assert(state.heroWidth > 0 && state.title.includes('一盤珠'), `${result.width}px hero is missing`)
    assert(state.images.every(image => image.naturalWidth > 0 && image.naturalHeight > 0), `${result.width}px has a broken image`)
    assert(result.errors.length === 0, `${result.width}px console errors: ${result.errors.join(' | ')}`)

    if (result.width <= 900) {
      assert(state.desktopDisplay === 'none' && state.mobileDisplay !== 'none', `${result.width}px does not use the mobile menu`)
      assert(state.floatingDisplay !== 'none', `${result.width}px mobile CTA is hidden`)
      assert(state.floatingCta.width <= 72 && state.floatingCta.height <= 72, `${result.width}px CTA is too large`)
      assert(state.floatingCta.rightGap >= 8 && state.floatingCta.rightGap <= 24, `${result.width}px CTA is misplaced`)
    } else {
      assert(state.desktopDisplay !== 'none' && state.mobileDisplay === 'none', 'desktop navigation visibility is wrong')
    }
  }

  console.log('PASS: Win珠心算 page reflows, images load, navigation works, and mobile controls meet target sizes')
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
})
