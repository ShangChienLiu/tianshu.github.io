(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms))
  let visibilityObserver

  const lesson = [
    { role: 'ai', text: '你把括號展開了。接下來要讓 2x 單獨留下，等式兩邊可以一起做什麼？', progress: 1 },
    { role: 'student', text: '兩邊都減 6。' },
    { role: 'ai', text: '很好。請把這一步寫出來，看看 2x 等於多少。', progress: 2, work: '2x + 6 = 18\n  − 6   − 6\n2x = 12' },
    { role: 'student', text: '2x = 12' },
    { role: 'ai', text: '現在 x 前面還有一個 2。等式兩邊同時除以多少，能讓 x 單獨留下？', progress: 3 },
    { role: 'student', text: '兩邊都除以 2，所以 x = 6。', work: '2x = 12\n÷ 2   ÷ 2\nx = 6' },
    { role: 'ai', text: '完成！把 x = 6 代回原式，左右兩邊會相等嗎？', progress: 3 },
    { role: 'student', text: '2 × (6 + 3) = 18，會相等。' }
  ]

  function setProgress (root, value) {
    root.querySelectorAll('[data-demo-progress] span').forEach((bar, index) => {
      bar.classList.toggle('is-active', index < value)
    })
  }

  function setSendState (root, state, label) {
    const status = root.querySelector('[data-demo-send-state]')
    status.classList.toggle('is-sending', state === 'sending')
    status.classList.toggle('is-sent', state === 'sent')
    root.querySelector('[data-demo-send-label]').textContent = label
  }

  function setLiveText (root, text) {
    root.querySelector('[data-demo-live]').textContent = text
  }

  async function typeText (element, text, delay, token) {
    element.classList.add('math-ai-demo__typing')
    element.textContent = ''
    for (const character of [...text]) {
      if (token.cancelled) return
      element.textContent += character
      await wait(delay)
    }
    element.classList.remove('math-ai-demo__typing')
  }

  async function typeWork (element, text, delay, token) {
    element.dataset.idle = 'false'
    element.textContent = ''
    for (const character of [...text]) {
      if (token.cancelled) return
      element.textContent += character
      await wait(delay)
    }
    element.dataset.idle = 'true'
  }

  async function addMessage (root, item, token) {
    const list = root.querySelector('[data-demo-messages]')
    const message = document.createElement('div')
    message.className = `math-ai-demo__message math-ai-demo__message--${item.role}`
    const speaker = document.createElement('span')
    speaker.className = 'math-ai-demo__speaker'
    speaker.textContent = item.role === 'ai' ? 'AI 老師' : '學生'
    const bubble = document.createElement('div')
    bubble.className = 'math-ai-demo__bubble'
    message.append(speaker, bubble)
    list.append(message)
    list.scrollTo({ top: list.scrollHeight, behavior: reducedMotion.matches ? 'auto' : 'smooth' })
    await typeText(bubble, item.text, item.role === 'ai' ? 31 : 38, token)
    if (token.cancelled) return
    setLiveText(root, `${speaker.textContent}：${item.text}`)
    list.scrollTo({ top: list.scrollHeight, behavior: reducedMotion.matches ? 'auto' : 'smooth' })
  }

  function showFinalState (root) {
    const work = root.querySelector('[data-demo-handwriting]')
    const list = root.querySelector('[data-demo-messages]')
    work.textContent = '2x = 12\n÷ 2   ÷ 2\nx = 6'
    work.dataset.idle = 'true'
    list.replaceChildren()
    lesson.slice(-4).forEach(item => {
      const message = document.createElement('div')
      message.className = `math-ai-demo__message math-ai-demo__message--${item.role}`
      message.style.opacity = '1'
      message.style.transform = 'none'
      const speaker = document.createElement('span')
      speaker.className = 'math-ai-demo__speaker'
      speaker.textContent = item.role === 'ai' ? 'AI 老師' : '學生'
      const bubble = document.createElement('div')
      bubble.className = 'math-ai-demo__bubble'
      bubble.textContent = item.text
      message.append(speaker, bubble)
      list.append(message)
    })
    list.scrollTop = list.scrollHeight
    setSendState(root, 'sent', '解題步驟已送給 AI 老師')
    setProgress(root, 3)
    setLiveText(root, '學生完成數學題：x 等於 6，代回原式驗證正確。')
  }

  async function runDemo (root) {
    if (root._demoToken) root._demoToken.cancelled = true
    const token = { cancelled: false }
    root._demoToken = token
    const work = root.querySelector('[data-demo-handwriting]')
    const list = root.querySelector('[data-demo-messages]')
    const route = root.querySelector('[data-demo-route]')
    list.replaceChildren()
    setProgress(root, 1)
    setSendState(root, 'writing', '正在手寫解題…')
    setLiveText(root, '學生正在解數學題：二乘以括號 x 加三等於十八。')

    if (reducedMotion.matches) {
      showFinalState(root)
      return
    }

    await typeWork(work, '2(x + 3) = 18\n2x + 6 = 18', 54, token)
    if (token.cancelled) return
    setSendState(root, 'sending', '正在把手寫步驟傳給 AI…')
    route.classList.remove('is-moving')
    void route.offsetWidth
    route.classList.add('is-moving')
    await wait(820)
    if (token.cancelled) return
    setSendState(root, 'sent', 'AI 已看見學生的解題步驟')

    for (const item of lesson) {
      if (token.cancelled) return
      if (item.progress) setProgress(root, item.progress)
      await addMessage(root, item, token)
      if (item.work) {
        await wait(320)
        await typeWork(work, item.work, 43, token)
        setSendState(root, 'sending', '正在把新步驟傳給 AI…')
        route.classList.remove('is-moving')
        void route.offsetWidth
        route.classList.add('is-moving')
        await wait(600)
        setSendState(root, 'sent', 'AI 已讀取最新的解題思路')
      }
      await wait(item.role === 'ai' ? 650 : 500)
    }

    if (token.cancelled) return
    setSendState(root, 'sent', '解題完成，已代回原式驗證')
    setLiveText(root, '學生完成數學題：x 等於 6，代回原式驗證正確。')
    await wait(4200)
    if (!token.cancelled) runDemo(root)
  }

  function initDemo (root) {
    if (root.dataset.mathAiReady === 'true') return
    root.dataset.mathAiReady = 'true'
    root.querySelector('[data-demo-replay]').addEventListener('click', () => runDemo(root))
    if (visibilityObserver) visibilityObserver.observe(root)
    runDemo(root)
  }

  function bootstrap () {
    const roots = document.querySelectorAll('[data-math-ai-demo]')
    roots.forEach(initDemo)
  }

  bootstrap()
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true })
  window.addEventListener('load', bootstrap, { once: true })
  const mutationObserver = new MutationObserver(bootstrap)
  mutationObserver.observe(document.documentElement, { childList: true, subtree: true })

  visibilityObserver = new IntersectionObserver(entries => {
    const demoIsVisible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0.22)
    document.body.classList.toggle('math-demo-in-view', demoIsVisible)
  }, { threshold: [0, 0.22, 0.6] })

  document.querySelectorAll('[data-math-ai-demo]').forEach(root => visibilityObserver.observe(root))

  reducedMotion.addEventListener('change', () => document.querySelectorAll('[data-math-ai-demo]').forEach(runDemo))
})()
