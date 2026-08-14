(() => {
  const targetFromLocation = () => {
    if (location.pathname.startsWith('/vispo')) return 'vispo'
    if (location.pathname.startsWith('/win')) return 'win'
    if (location.pathname.startsWith('/contact')) return 'contact'
    return new URLSearchParams(location.search).get('page') || 'home'
  }

  const select = (header, target) => {
    const items = header.querySelectorAll('[data-header-target]')
    items.forEach(item => {
      const active = item.dataset.headerTarget === target
      item.classList.toggle('is-active', active)
      if (active) item.setAttribute('aria-current', 'page')
      else item.removeAttribute('aria-current')
    })
  }

  let currentTarget = targetFromLocation()

  const init = () => {
    document.querySelectorAll('.shared-site-header').forEach(header => {
      select(header, currentTarget)
      if (header.dataset.sharedHeaderReady === 'true') return
      header.dataset.sharedHeaderReady = 'true'
      header.addEventListener('click', event => {
        const item = event.target.closest('[data-header-target]')
        if (!item) return
        currentTarget = item.dataset.headerTarget
        select(header, currentTarget)
      })
    })
  }

  const start = () => {
    init()
    new MutationObserver(init).observe(document.documentElement, { childList: true, subtree: true })
    ;[60, 180, 500, 1000].forEach(delay => setTimeout(init, delay))
    addEventListener('popstate', () => {
      currentTarget = targetFromLocation()
      init()
    })
  }

  start()
})()
