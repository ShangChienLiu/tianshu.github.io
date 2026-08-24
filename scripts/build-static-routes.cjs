#!/usr/bin/env node

const { copyFileSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { dirname, join } = require('node:path')

const repositoryRoot = join(__dirname, '..')
const sourcePath = join(repositoryRoot, 'site', 'index.html')
const imageSlotsPath = join(repositoryRoot, 'site', '.image-slots.state.json')
const sourceHtml = readFileSync(sourcePath, 'utf8')

const routes = [
  {
    slug: 'story',
    section: 'Story',
    label: '品牌故事',
    handler: 'goStory',
    title: '品牌故事｜天樞文理補習班',
    description: '了解天樞文理補習班的教育理念、學習陪伴方式與北斗七星文教的品牌故事。'
  },
  {
    slug: 'team',
    section: 'Team',
    label: '師資團隊',
    handler: 'goTeam',
    title: '師資團隊｜天樞文理補習班',
    description: '認識天樞文理補習班的主任與教師團隊，以及數學、珠心算、AI 與學生關懷的專業背景。'
  },
  {
    slug: 'contact',
    section: 'Contact',
    label: '聯絡我們',
    handler: 'goContact',
    title: '聯絡我們｜天樞文理補習班',
    description: '聯絡天樞文理補習班，加入 LINE 洽詢課程、預約體驗並了解教室位置與營業時間。'
  }
]

function replaceRequired (html, source, replacement, route) {
  if (!html.includes(source)) throw new Error(`${route} static route source is missing: ${source}`)
  return html.replace(source, replacement)
}

function buildRoute (route) {
  let html = sourceHtml
  const url = `https://skybookedu.com/${route.slug}/`
  const path = `/${route.slug}/`

  const replacements = [
    ['<title>天樞文理補習班｜北斗七星文教</title>', `<title>${route.title}</title>`],
    ['<meta name="description" content="天樞文理補習班提供課程諮詢、學習規劃與體驗預約服務。">', `<meta name="description" content="${route.description}">`],
    ['<link rel="canonical" href="https://skybookedu.com/">', `<link rel="canonical" href="${url}">`],
    ['<meta property="og:title" content="天樞文理補習班｜北斗七星文教">', `<meta property="og:title" content="${route.title}">`],
    ['<meta property="og:url" content="https://skybookedu.com/">', `<meta property="og:url" content="${url}">`],
    ['<meta name="twitter:title" content="天樞文理補習班｜北斗七星文教">', `<meta name="twitter:title" content="${route.title}">`],
    [
      '<a class="shared-nav-item is-active" data-header-target="home" href="/" sc-camel-on-click="{{ goHome }}" aria-current="page">首頁</a>',
      '<a class="shared-nav-item" data-header-target="home" href="/" sc-camel-on-click="{{ goHome }}">首頁</a>'
    ],
    [
      '<a class="shared-mobile-item is-active" data-header-target="home" href="/" sc-camel-on-click="{{ goHome }}" aria-current="page">首頁</a>',
      '<a class="shared-mobile-item" data-header-target="home" href="/" sc-camel-on-click="{{ goHome }}">首頁</a>'
    ],
    [
      `<a class="shared-nav-item" data-header-target="${route.slug}" href="${path}" sc-camel-on-click="{{ ${route.handler} }}">${route.label}</a>`,
      `<a class="shared-nav-item is-active" data-header-target="${route.slug}" href="${path}" sc-camel-on-click="{{ ${route.handler} }}" aria-current="page">${route.label}</a>`
    ],
    [
      `<a class="shared-mobile-item" data-header-target="${route.slug}" href="${path}" sc-camel-on-click="{{ ${route.handler} }}">${route.label}</a>`,
      `<a class="shared-mobile-item is-active" data-header-target="${route.slug}" href="${path}" sc-camel-on-click="{{ ${route.handler} }}" aria-current="page">${route.label}</a>`
    ],
    [
      '<sc-if value="{{ isHome }}" hint-placeholder-val="{{ true }}">',
      '<sc-if value="{{ isHome }}" hint-placeholder-val="{{ false }}">'
    ],
    [
      `<sc-if value="{{ is${route.section} }}" hint-placeholder-val="{{ false }}">`,
      `<sc-if value="{{ is${route.section} }}" hint-placeholder-val="{{ true }}">`
    ]
  ]

  for (const [source, replacement] of replacements) {
    html = replaceRequired(html, source, replacement, route.slug)
  }

  const outputPath = join(repositoryRoot, 'site', route.slug, 'index.html')
  const outputDirectory = dirname(outputPath)
  mkdirSync(outputDirectory, { recursive: true })
  writeFileSync(outputPath, html)
  copyFileSync(imageSlotsPath, join(outputDirectory, '.image-slots.state.json'))
  console.log(`Built ${outputPath}`)
}

routes.forEach(buildRoute)
