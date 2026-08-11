#!/usr/bin/env node

const { chromium } = require('playwright')

const executablePath = '/Users/shangchienliu/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'
const routes = ['/', '/vispo/', '/win/']
const expectedActive = { '/': '首頁', '/vispo/': 'Vispo 數學 NEW', '/win/': 'Win珠心算 HOT' }

function assert (condition, message) {
  if (!condition) throw new Error(message)
}

function near (a, b, tolerance = 0.6) {
  return Math.abs(a - b) <= tolerance
}

async function inspect (browser, route, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 } })
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:4180${route}`, { waitUntil: 'networkidle' })
  if (route === '/') await page.waitForSelector('#dc-root')
  const result = await page.evaluate(() => {
    const header = document.querySelector('header')
    const brand = header.querySelector('a[aria-label*="天樞文理補習班"], .om-brand')
    const logo = brand.querySelector('img')
    const desktopNav = header.querySelector('nav:not(.mobile-menu-panel)')
    const mobileMenu = header.querySelector('details')
    const rect = element => {
      const value = element.getBoundingClientRect()
      return { left: value.left, top: value.top, width: value.width, height: value.height }
    }
    const navItems = [...desktopNav.children].map(element => {
      const style = getComputedStyle(element)
      return {
        label: element.textContent.trim().replace(/\s+/g, ' '),
        rect: rect(element),
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        padding: style.padding,
        background: style.backgroundColor,
        active: element.classList.contains('is-active') || element.getAttribute('aria-current') === 'page'
      }
    })
    return {
      header: rect(header),
      brand: rect(brand),
      brandText: brand.textContent.trim().replace(/\s+/g, ' '),
      logo: { src: new URL(logo.getAttribute('src'), location.href).pathname, ...rect(logo) },
      navDisplay: getComputedStyle(desktopNav).display,
      navItems,
      mobileDisplay: getComputedStyle(mobileMenu).display,
      mobileTrigger: rect(mobileMenu.querySelector('summary')),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }
  })
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo({ top: 700, behavior: 'instant' })
  })
  await page.waitForTimeout(40)
  result.sticky = await page.evaluate(route => {
    const header = document.querySelector('header')
    const banner = document.querySelector(route === '/' ? '.om-vispo-promo' : '.announcement')
    const headerRect = header.getBoundingClientRect()
    const bannerRect = banner.getBoundingClientRect()
    return {
      scrollY,
      headerPosition: getComputedStyle(header).position,
      bannerPosition: getComputedStyle(banner).position,
      headerTop: headerRect.top,
      headerBottom: headerRect.bottom,
      bannerTop: bannerRect.top
    }
  }, route)
  await context.close()
  return result
}

function compareGeometry (reference, candidate, route, width) {
  for (const key of ['height']) {
    assert(near(reference.header[key], candidate.header[key]), `${route} ${width}px header ${key} differs from home: ${candidate.header[key]} vs ${reference.header[key]}`)
  }
  for (const key of ['left', 'width', 'height']) {
    assert(near(reference.logo[key], candidate.logo[key]), `${route} ${width}px logo ${key} differs from home`)
  }
  assert(candidate.logo.src === reference.logo.src, `${route} ${width}px uses a different logo asset: ${candidate.logo.src}`)
  assert(candidate.brandText === '天樞文理補習班', `${route} ${width}px brand text differs: ${candidate.brandText}`)
  assert(candidate.overflow <= 1, `${route} ${width}px header causes horizontal overflow`)
  assert(candidate.sticky.scrollY > 200, `${route} ${width}px page did not scroll for the sticky check`)
  assert(candidate.sticky.headerPosition === 'sticky' && near(candidate.sticky.headerTop, 0), `${route} ${width}px header does not remain fixed at the top`)
  assert(candidate.sticky.bannerPosition === 'sticky', `${route} ${width}px course banner is not sticky`)
  assert(near(candidate.sticky.bannerTop, candidate.sticky.headerBottom), `${route} ${width}px sticky banner does not stay directly below the header`)

  if (width >= 900) {
    assert(candidate.navDisplay === reference.navDisplay, `${route} ${width}px desktop nav visibility differs`)
    assert(candidate.navItems.length === reference.navItems.length, `${route} ${width}px nav item count differs`)
    for (let index = 0; index < reference.navItems.length; index++) {
      const expected = reference.navItems[index]
      const actual = candidate.navItems[index]
      assert(actual.label === expected.label, `${route} ${width}px nav label ${index} differs: ${actual.label}`)
      for (const key of ['width', 'height']) assert(near(actual.rect[key], expected.rect[key]), `${route} ${width}px ${actual.label} ${key} differs from home`)
      for (const key of ['fontSize', 'fontWeight', 'padding']) assert(actual[key] === expected[key], `${route} ${width}px ${actual.label} ${key} differs from home`)
    }
  } else {
    assert(candidate.mobileDisplay === reference.mobileDisplay, `${route} ${width}px mobile menu visibility differs`)
    assert(near(candidate.mobileTrigger.width, reference.mobileTrigger.width) && near(candidate.mobileTrigger.height, reference.mobileTrigger.height), `${route} ${width}px mobile trigger differs from home`)
  }
}

async function main () {
  const browser = await chromium.launch({ executablePath, headless: true })
  try {
    for (const width of [390, 1280]) {
      const results = {}
      for (const route of routes) results[route] = await inspect(browser, route, width)
      for (const route of routes) compareGeometry(results['/'], results[route], route, width)

      if (width === 1280) {
        for (const route of routes) {
          const active = results[route].navItems.filter(item => item.active)
          assert(active.length === 1, `${route} must have exactly one selected desktop tab, found ${active.length}`)
          assert(active[0].label === expectedActive[route], `${route} selected the wrong tab: ${active[0].label}`)
          const colored = results[route].navItems.filter(item => item.background !== 'rgba(0, 0, 0, 0)')
          assert(colored.length === 1 && colored[0].label === active[0].label, `${route} colors tabs other than the selected tab`)
        }
      }
      console.log(`${width}px ${routes.map(route => `${route}:${results[route].header.height.toFixed(1)}px logo=${results[route].logo.width.toFixed(1)}px`).join(' | ')}`)
    }

    const context = await browser.newContext({ viewport: { width: 1280, height: 844 } })
    const page = await context.newPage()
    for (const [target, label] of [['story', '品牌故事'], ['team', '師資團隊'], ['contact', '聯絡我們']]) {
      await page.goto(`http://127.0.0.1:4180/?page=${target}`, { waitUntil: 'networkidle' })
      await page.waitForSelector('#dc-root')
      await page.waitForTimeout(700)
      const selected = await page.evaluate(() => [...document.querySelectorAll('.shared-nav > .shared-nav-item')]
        .filter(item => item.classList.contains('is-active') || item.getAttribute('aria-current') === 'page')
        .map(item => item.textContent.trim().replace(/\s+/g, ' ')))
      assert(selected.length === 1 && selected[0] === label, `/?page=${target} selected the wrong tab: ${selected.join(', ')}`)
    }
    await context.close()
  } finally {
    await browser.close()
  }
  console.log('PASS: every page uses the same header geometry and only the selected tab is colored')
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
})
