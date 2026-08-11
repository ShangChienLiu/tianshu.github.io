#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright')

const executablePath = '/Users/shangchienliu/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'
const siteRoot = path.join(__dirname, '..', 'site')

const failures = []

function check (condition, message) {
  if (!condition) failures.push(message)
}

function siteFiles (directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return siteFiles(target)
    return /\.(?:html|css|js|json|xml|txt)$/i.test(entry.name) ? [target] : []
  })
}

async function inspect (browser, route) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:4180${route}`, { waitUntil: 'networkidle' })
  if (route === '/') await page.waitForSelector('#dc-root')

  const result = await page.evaluate(() => {
    const links = [...document.querySelectorAll('header nav:first-of-type .course-link')].map(link => {
      const badge = link.querySelector('[data-course-badge], span')
      const linkRect = link.getBoundingClientRect()
      const badgeRect = badge.getBoundingClientRect()
      return {
        label: link.textContent.trim().replace(/\s+/g, ' '),
        active: link.classList.contains('active'),
        linkHeight: linkRect.height,
        badgeWidth: badgeRect.width,
        badgeHeight: badgeRect.height
      }
    })
    const footerLogo = document.querySelector('footer img')
    const logoRect = footerLogo?.getBoundingClientRect()
    const header = document.querySelector('.site-header')
    const announcement = document.querySelector('.announcement')
    const headerRect = header?.getBoundingClientRect()
    const announcementRect = announcement?.getBoundingClientRect()
    return {
      links,
      bodyText: document.body.innerText,
      announcement: announcement
        ? {
            followsHeader: announcement.previousElementSibling === header,
            gapAfterHeader: announcementRect.top - headerRect.bottom
          }
        : null,
      footerLogo: footerLogo
        ? {
            src: footerLogo.getAttribute('src'),
            renderedRatio: logoRect.width / logoRect.height,
            naturalRatio: footerLogo.naturalWidth / footerLogo.naturalHeight
          }
        : null
    }
  })
  await context.close()
  return result
}

async function main () {
  const staleFiles = siteFiles(siteRoot).filter(file => fs.readFileSync(file, 'utf8').includes('關埔'))
  check(staleFiles.length === 0, `site still contains 關埔 in: ${staleFiles.map(file => path.relative(siteRoot, file)).join(', ')}`)

  const browser = await chromium.launch({ executablePath, headless: true })
  try {
    const results = {}
    for (const route of ['/', '/vispo/', '/win/']) {
      results[route] = await inspect(browser, route)
      const logo = results[route].footerLogo
      check(logo, `${route} footer is missing the brand logo`)
      if (logo) {
        check(Math.abs(logo.naturalRatio - 1) < 0.02, `${route} footer logo asset is not square: ${logo.src}`)
        check(Math.abs(logo.renderedRatio - 1) < 0.02, `${route} footer logo is stretched: ${logo.renderedRatio}`)
      }
      check(!results[route].bodyText.includes('關埔'), `${route} still renders 關埔`)
    }

    for (const route of ['/vispo/', '/win/']) {
      const links = results[route].links
      const announcement = results[route].announcement
      check(links.length === 2, `${route} desktop course tabs were not found`)
      check(announcement?.followsHeader, `${route} course banner is not directly below the header`)
      if (announcement) check(Math.abs(announcement.gapAfterHeader) <= 1, `${route} course banner is detached from the header`)
      if (links.length) check(Math.max(...links.map(link => link.linkHeight)) - Math.min(...links.map(link => link.linkHeight)) <= 1, `${route} active course tab changes height`)
      console.log(`${route} ${links.map(link => `${link.label}:${link.linkHeight.toFixed(1)}px badge=${link.badgeWidth.toFixed(1)}x${link.badgeHeight.toFixed(1)}`).join(' | ')}`)
    }

    const activeHot = results['/win/'].links.find(link => link.label.includes('HOT'))
    const inactiveHot = results['/vispo/'].links.find(link => link.label.includes('HOT'))
    check(Math.abs(activeHot.badgeHeight - inactiveHot.badgeHeight) <= 1, `HOT badge grows when active: ${inactiveHot.badgeHeight}px -> ${activeHot.badgeHeight}px`)
    check(Math.abs(activeHot.badgeWidth - inactiveHot.badgeWidth) <= 1, `HOT badge changes width when active: ${inactiveHot.badgeWidth}px -> ${activeHot.badgeWidth}px`)
  } finally {
    await browser.close()
  }

  if (failures.length) throw new Error(`\n- ${failures.join('\n- ')}`)
  console.log('PASS: course tab geometry, square footer logos, course banner position, and campus naming are consistent')
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
})
