#!/usr/bin/env node

const { mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { dirname, join } = require('node:path')

const repositoryRoot = join(__dirname, '..')
const sourcePath = join(repositoryRoot, 'site', 'index.html')
const contactPath = join(repositoryRoot, 'site', 'contact', 'index.html')

let contactHtml = readFileSync(sourcePath, 'utf8')
const replacements = [
  ['<title>天樞文理補習班｜北斗七星文教</title>', '<title>聯絡我們｜天樞文理補習班</title>'],
  ['<meta name="description" content="天樞文理補習班提供課程諮詢、學習規劃與體驗預約服務。">', '<meta name="description" content="聯絡天樞文理補習班，加入 LINE 洽詢課程、預約體驗並了解教室位置與營業時間。">'],
  ['<link rel="canonical" href="https://skybookedu.com/">', '<link rel="canonical" href="https://skybookedu.com/contact/">'],
  ['<meta property="og:title" content="天樞文理補習班｜北斗七星文教">', '<meta property="og:title" content="聯絡我們｜天樞文理補習班">'],
  ['<meta property="og:url" content="https://skybookedu.com/">', '<meta property="og:url" content="https://skybookedu.com/contact/">'],
  ['<meta name="twitter:title" content="天樞文理補習班｜北斗七星文教">', '<meta name="twitter:title" content="聯絡我們｜天樞文理補習班">']
]

for (const [source, replacement] of replacements) {
  if (!contactHtml.includes(source)) throw new Error(`Static route source is missing: ${source}`)
  contactHtml = contactHtml.replace(source, replacement)
}

mkdirSync(dirname(contactPath), { recursive: true })
writeFileSync(contactPath, contactHtml)
console.log(`Built ${contactPath}`)
