(() => {
  const menuSelector = '.om-mobile-menu[open], .mobile-menu[open]'

  document.addEventListener('pointerdown', event => {
    document.querySelectorAll(menuSelector).forEach(menu => {
      if (!menu.contains(event.target)) menu.removeAttribute('open')
    })
  })

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return
    document.querySelectorAll(menuSelector).forEach(menu => {
      menu.removeAttribute('open')
      menu.querySelector(':scope > summary')?.focus()
    })
  })
})()
