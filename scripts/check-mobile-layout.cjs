#!/usr/bin/env node

const { chromium } = require('playwright')

const executablePath = '/Users/shangchienliu/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'

async function inspectMenu (page, url, headerSelector, desktopSelector, mobileSelector, interactiveRoot) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  if (interactiveRoot) await page.waitForSelector(interactiveRoot)
  const closed = await page.evaluate(({ headerSelector, desktopSelector, mobileSelector }) => {
    const header = document.querySelector(headerSelector)
    const desktop = document.querySelector(desktopSelector)
    const mobile = document.querySelector(mobileSelector)
    return {
      viewportWidth: document.documentElement.clientWidth,
      headerHeight: header?.getBoundingClientRect().height ?? -1,
      desktopDisplay: desktop ? getComputedStyle(desktop).display : 'missing',
      mobileDisplay: mobile ? getComputedStyle(mobile).display : 'missing'
    }
  }, { headerSelector, desktopSelector, mobileSelector })

  if (closed.mobileDisplay === 'missing') return { ...closed, menu: null }

  await page.locator(`${mobileSelector} > summary`).click()
  const menu = await page.locator(`${mobileSelector} .mobile-menu-panel`).evaluate(panel => {
    const rect = panel.getBoundingClientRect()
    const targets = [...panel.querySelectorAll('a,button')].map(target => {
      const targetRect = target.getBoundingClientRect()
      return { text: target.textContent.trim(), width: targetRect.width, height: targetRect.height }
    })
    return {
      left: rect.left,
      right: rect.right,
      width: rect.width,
      targets
    }
  })
  const trigger = await page.locator(`${mobileSelector} > summary`).evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })
  await page.mouse.click(8, 400)
  const closesOnOutsideClick = await page.locator(mobileSelector).evaluate(element => !element.open)
  return { ...closed, trigger, menu, closesOnOutsideClick }
}

function assertMenu (name, result) {
  if (result.desktopDisplay !== 'none' || result.mobileDisplay === 'missing' || result.mobileDisplay === 'none') {
    throw new Error(`${name} does not use a dedicated compact mobile menu`)
  }
  if (result.headerHeight > 84 || result.headerHeight < 52) {
    throw new Error(`${name} mobile header is not compact`)
  }
  if (result.trigger.width < 44 || result.trigger.height < 44) {
    throw new Error(`${name} menu trigger is smaller than 44px`)
  }
  if (result.menu.left < 12 || result.menu.right > result.viewportWidth - 12) {
    throw new Error(`${name} menu panel extends outside the viewport`)
  }
  if (result.menu.targets.some(target => target.height < 44)) {
    throw new Error(`${name} menu contains a touch target smaller than 44px`)
  }
  if (!result.closesOnOutsideClick) {
    throw new Error(`${name} menu stays open after clicking outside it`)
  }
}

async function main () {
  const browser = await chromium.launch({ executablePath, headless: true })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()

  const home = await inspectMenu(page, 'http://127.0.0.1:4180/', 'header', '.om-nav', '.om-mobile-menu', '#dc-root')
  const win = await inspectMenu(page, 'http://127.0.0.1:4180/win/', '.site-header', '.nav', '.mobile-menu')
  const cta = await page.locator('.mobile-cta').evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { width: rect.width, height: rect.height, rightGap: document.documentElement.clientWidth - rect.right }
  })
  console.log(`home_mobile_menu=${JSON.stringify(home)}`)
  console.log(`win_mobile_menu=${JSON.stringify(win)}`)
  console.log(`win_mobile_cta=${JSON.stringify(cta)}`)

  assertMenu('home', home)
  assertMenu('win', win)
  if (cta.width > 72 || cta.height > 72 || Math.abs(cta.width - cta.height) > 1 || cta.rightGap < 8 || cta.rightGap > 24) {
    throw new Error('Win mobile CTA is not a compact lower-right circle')
  }

  const tabletContext = await browser.newContext({ viewport: { width: 840, height: 900 } })
  const tabletPage = await tabletContext.newPage()
  await tabletPage.goto('http://127.0.0.1:4180/', { waitUntil: 'domcontentloaded' })
  await tabletPage.waitForSelector('#dc-root')
  const tabletHeader = await tabletPage.evaluate(() => ({
    height: document.querySelector('header')?.getBoundingClientRect().height ?? -1,
    desktopDisplay: getComputedStyle(document.querySelector('.om-nav')).display,
    mobileDisplay: getComputedStyle(document.querySelector('.om-mobile-menu')).display,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth
  }))
  await tabletContext.close()
  await browser.close()
  if (tabletHeader.desktopDisplay !== 'none' || tabletHeader.mobileDisplay === 'none' || tabletHeader.height > 84 || tabletHeader.scrollWidth > tabletHeader.viewportWidth + 1) {
    throw new Error('homepage tablet header wraps instead of using the compact menu')
  }
  console.log('PASS: mobile headers are compact and menus are touch-friendly')
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
})
