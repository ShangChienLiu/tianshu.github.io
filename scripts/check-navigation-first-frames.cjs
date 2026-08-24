#!/usr/bin/env node

const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const repositoryRoot = join(__dirname, '..')
const siteRoot = join(repositoryRoot, 'site')
const routeTitles = {
  home: '天樞文理補習班｜北斗七星文教',
  story: '品牌故事｜天樞文理補習班',
  team: '師資團隊｜天樞文理補習班',
  contact: '聯絡我們｜天樞文理補習班'
}

function assert (condition, message) {
  if (!condition) throw new Error(message)
}

function readRoute (route) {
  return readFileSync(route === 'home'
    ? join(siteRoot, 'index.html')
    : join(siteRoot, route, 'index.html'), 'utf8')
}

function activeTargets (html) {
  return [...html.matchAll(/class="[^"]*\bis-active\b[^"]*"[^>]*data-header-target="([^"]+)"/g)]
    .map(match => match[1])
}

function assertInitialRoute (route, renderedSections = []) {
  const html = readRoute(route)
  const active = activeTargets(html)
  assert(active.length === 2, `${route} initial HTML must select exactly two navigation items`)
  assert(active.every(target => target === route), `${route} initial HTML selects ${active.join(', ')} instead of ${route}`)
  assert(html.includes(`<title>${routeTitles[route]}</title>`), `${route} title is incorrect`)
  const canonical = route === 'home' ? 'https://skybookedu.com/' : `https://skybookedu.com/${route}/`
  assert(html.includes(`<link rel="canonical" href="${canonical}">`), `${route} canonical URL is incorrect`)
  if (route !== 'home') {
    assert(existsSync(join(siteRoot, route, '.image-slots.state.json')), `${route} image-slot state file is missing`)
  }

  for (const section of ['Home', 'Story', 'Team', 'Contact']) {
    const shouldRender = renderedSections.includes(section)
    const expected = `<sc-if value="{{ is${section} }}" hint-placeholder-val="{{ ${shouldRender} }}">`
    assert(html.includes(expected), `${route} initial HTML has the wrong first-frame visibility for ${section}`)
  }
}

assertInitialRoute('home', ['Home'])
assertInitialRoute('story', ['Story'])
assertInitialRoute('team', ['Team'])
assertInitialRoute('contact', ['Contact'])

for (const route of ['vispo', 'win']) {
  const html = readRoute(route)
  const active = activeTargets(html)
  assert(active.length === 2 && active.every(target => target === route), `${route} initial HTML selects the wrong navigation item`)
  assert((html.match(/data-header-target="story" href="\/story\/"/g) || []).length === 2, `${route} brand-story links do not use /story/`)
  assert((html.match(/data-header-target="team" href="\/team\/"/g) || []).length === 2, `${route} team links do not use /team/`)
}

const sourceHtml = readRoute('home')
const sharedHeader = readFileSync(join(siteRoot, 'assets', 'shared-header.js'), 'utf8')
for (const target of ['story', 'team', 'contact']) {
  const handler = new RegExp(`go${target[0].toUpperCase()}${target.slice(1)}:\\s*\\(e\\)\\s*=>\\s*\\{\\s*if \\(e\\) e\\.preventDefault\\(\\);\\s*this\\.go\\('${target}'\\);\\s*\\}`)
  assert(handler.test(sourceHtml), `${target} navigation does not prevent a redundant full-page reload`)
}

assert(sourceHtml.includes("if (path === '/story') return 'story'"), 'route state does not recognise /story/')
assert(sourceHtml.includes("if (path === '/team') return 'team'"), 'route state does not recognise /team/')
assert(sharedHeader.includes("location.pathname.startsWith('/story')"), 'shared header does not recognise /story/')
assert(sharedHeader.includes("location.pathname.startsWith('/team')"), 'shared header does not recognise /team/')
assert(sourceHtml.includes("addEventListener('popstate', this.handlePopState)"), 'browser history does not update page content')
assert(sourceHtml.includes("removeEventListener('popstate', this.handlePopState)"), 'browser history listener is not cleaned up')

console.log('PASS: every global navigation target renders the correct first frame')
