#!/usr/bin/env node

const { chromium } = require('playwright')

const executablePath = '/Users/shangchienliu/Library/Caches/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-mac-arm64/chrome-headless-shell'
const copyright = '© 2026 北斗七星文教｜天樞文理補習班'

function assert (condition, message) {
  if (!condition) throw new Error(message)
}

async function inspect (browser, path, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 } })
  const page = await context.newPage()
  await page.goto(`http://127.0.0.1:4180${path}`, { waitUntil: 'networkidle' })
  if (path === '/') await page.waitForSelector('#dc-root')

  const result = await page.evaluate(() => {
    const keepLines = [...document.querySelectorAll('[data-keep-line]')].map(element => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const rect = element.getBoundingClientRect()
      const lineRects = [...range.getClientRects()].filter(line => line.width > 0 && line.height > 0)
      return {
        text: element.textContent.trim(),
        lineCount: lineRects.length,
        left: rect.left,
        right: rect.right,
        whiteSpace: getComputedStyle(element).whiteSpace
      }
    })
    return {
      text: document.body.innerText,
      html: document.documentElement.outerHTML,
      copyright: document.querySelector('.site-copyright')?.textContent.trim() || '',
      newBadges: [...document.querySelectorAll('[data-course-badge="new"]')].map(element => element.textContent.trim()),
      keepLines,
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }
  })
  await context.close()
  return result
}

async function main () {
  const browser = await chromium.launch({ executablePath, headless: true })
  try {
    for (const width of [320, 390, 1280]) {
      for (const path of ['/', '/vispo/', '/win/']) {
        const result = await inspect(browser, path, width)
        console.log(`${path}_${width}=copyright:${result.copyright} new:${result.newBadges.length} lines:${result.keepLines.length}`)

        assert(result.copyright === copyright, `${path} ${width}px footer copyright is inconsistent`)
        assert(result.newBadges.length >= 1 && result.newBadges.every(label => label === 'NEW'), `${path} ${width}px is missing the Vispo NEW badge`)
        assert(!/Win\s+珠心(?!算)/.test(result.text), `${path} ${width}px still contains "Win 珠心"`)
        assert(!/Win珠心(?!算)/.test(result.text), `${path} ${width}px still contains an incomplete Win珠心算 name`)
        assert(result.scrollWidth <= result.viewportWidth + 1, `${path} ${width}px overflows horizontally`)

        if (path !== '/') {
          assert(!/(不是|不能|不只|不需|不靠|不用|不代表|適不適合|嚴格限制|卡住|錯誤|盲點|弱項)/.test(result.text), `${path} ${width}px still contains negative-turn copy`)
          assert(!result.text.includes('？'), `${path} ${width}px still contains question-style copy`)
          assert(result.keepLines.length >= 8, `${path} ${width}px does not provide semantic headline lines`)
          for (const line of result.keepLines) {
            assert(line.lineCount === 1, `${path} ${width}px breaks this phrase again: ${line.text}`)
            assert(line.left >= -1 && line.right <= result.viewportWidth + 1, `${path} ${width}px clips this phrase: ${line.text}`)
            assert(line.whiteSpace === 'nowrap', `${path} ${width}px does not lock this semantic line: ${line.text}`)
          }
        }

        if (path === '/vispo/') {
          for (const name of ['史丹佛', '卡內基美隆', '臺灣大學', '漢堡大學', 'Meta', 'Google', 'Uber']) {
            assert(result.text.includes(name), `/vispo/ ${width}px is missing confirmed lecture credential: ${name}`)
          }
          for (const stage of ['AI 數學力診斷', '實驗班體驗課', '獨立作答驗證', '家長 20 分鐘解讀']) {
            assert(result.text.includes(stage), `/vispo/ ${width}px is missing experience-day stage: ${stage}`)
          }
          assert(result.text.includes('系列講座安排於 Vispo 正式課程期間'), `/vispo/ ${width}px does not distinguish the lecture series from the experience day`)
          assert(result.html.indexOf('id="lecture-series"') < result.html.indexOf('id="experience-day"'), `/vispo/ ${width}px does not lead with the lecture series`)
        }
      }
    }
  } finally {
    await browser.close()
  }
  console.log('PASS: course names, NEW badges, semantic headline lines, and footer copyright are consistent')
}

main().catch(error => {
  console.error(`FAIL: ${error.message}`)
  process.exitCode = 1
})
