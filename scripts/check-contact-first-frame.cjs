#!/usr/bin/env node

const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const repositoryRoot = join(__dirname, '..')
const sourceHtml = readFileSync(join(repositoryRoot, 'site', 'index.html'), 'utf8')
const contactHtml = readFileSync(join(repositoryRoot, 'site', 'contact', 'index.html'), 'utf8')

function assert (condition, message) {
  if (!condition) throw new Error(message)
}

const activeTargets = [...contactHtml.matchAll(/class="[^"]*\bis-active\b[^"]*"[^>]*data-header-target="([^"]+)"/g)]
  .map(match => match[1])

assert(!activeTargets.includes('home'), 'contact initial HTML briefly selects the home tab')
assert(activeTargets.filter(target => target === 'contact').length === 2, 'contact initial HTML must select both contact navigation items')
assert(contactHtml.includes('<sc-if value="{{ isHome }}" hint-placeholder-val="{{ false }}">'), 'contact initial HTML briefly displays home content')
assert(contactHtml.includes('<sc-if value="{{ isContact }}" hint-placeholder-val="{{ true }}">'), 'contact initial HTML hides contact content')
assert(/goContact:\s*\(e\)\s*=>\s*\{\s*if \(e\) e\.preventDefault\(\);\s*this\.go\('contact'\);\s*\}/.test(sourceHtml), 'contact navigation does not prevent a redundant full-page reload')

console.log('PASS: contact route renders the correct first frame without a redundant reload')
