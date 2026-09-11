/**
 * 【界面层】只管渲染，不掺业务逻辑
 */

import { MODE_META } from './persona.js'
import { AID_RESOURCES } from './crisis.js'

const AVATAR = 'assets/xiaomiao.jpg'

const $ = (id) => document.getElementById(id)

export const el = {
  app: $('app'),
  welcome: $('welcome'),
  chat: $('chat'),
  input: $('input'),
  btnSend: $('btnSend'),
  btnReset: $('btnReset'),
  btnSettings: $('btnSettings'),
  btnCloseSheet: $('btnCloseSheet'),
  sheet: $('sheet'),
  sheetMask: $('sheetMask'),
  noticeBar: $('noticeBar'),
  modeChip: $('modeChip'),
  moodLabel: $('moodLabel'),
  apiKey: $('apiKey'),
  apiBase: $('apiBase'),
  modelPick: $('modelPick'),
  memoryToggle: $('memoryToggle'),
  btnWipe: $('btnWipe'),
  keyHint: $('keyHint'),
  welcomeHints: $('welcomeHints'),
}

/** 把（）里的动作描写弱化显示 */
function decorate(text) {
  const frag = document.createDocumentFragment()
  const re = /（[^）]{1,30}）|\([^)]{1,30}\)/g
  let last = 0
  let m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) frag.append(text.slice(last, m.index))
    const span = document.createElement('span')
    span.className = 'act'
    span.textContent = m[0]
    frag.append(span)
    last = m.index + m[0].length
  }
  if (last < text.length) frag.append(text.slice(last))
  return frag
}

function makeAvatar() {
  const img = document.createElement('img')
  img.className = 'msg-avatar'
  img.src = AVATAR
  img.alt = '筱喵'
  return img
}

/** 追加一条消息 */
export function pushMessage(who, text) {
  el.welcome.hidden = true

  const row = document.createElement('div')
  row.className = 'msg'
  row.dataset.who = who

  if (who === 'her') row.append(makeAvatar())

  const bubble = document.createElement('div')
  bubble.className = 'bubble'
  if (who === 'her') bubble.append(decorate(text))
  else bubble.textContent = text
  row.append(bubble)

  el.chat.append(row)
  scrollToEnd()
  return bubble
}

/** 追加一条居中系统提示 */
export function pushSystemNote(text) {
  const note = document.createElement('div')
  note.className = 'sys-note'
  note.textContent = text
  el.welcome.hidden = true
  el.chat.append(note)
  scrollToEnd()
}

/** 危机资源卡（硬编码，不经过模型） */
export function pushAidCard() {
  const card = document.createElement('div')
  card.className = 'aid-card'

  const h = document.createElement('h5')
  h.textContent = '如果情况紧急，这些号码随时可以打'
  card.append(h)

  const list = document.createElement('div')
  list.className = 'aid-list'

  for (const r of AID_RESOURCES) {
    const item = document.createElement('div')
    item.className = 'aid-item'
    const b = document.createElement('b')
    b.textContent = r.number
    const s = document.createElement('span')
    s.textContent = r.label
    item.append(b, s)
    list.append(item)
  }

  card.append(list)
  el.chat.append(card)
  scrollToEnd()
}

/** 「筱喵正在打字…」 */
export function showTyping() {
  el.welcome.hidden = true
  const row = document.createElement('div')
  row.className = 'msg typing'
  row.dataset.who = 'her'
  row.id = 'typingRow'
  row.append(makeAvatar())

  const bubble = document.createElement('div')
  bubble.className = 'bubble'
  for (let i = 0; i < 3; i++) bubble.append(document.createElement('i'))
  row.append(bubble)

  el.chat.append(row)
  scrollToEnd()
}

export function hideTyping() {
  document.getElementById('typingRow')?.remove()
}

/** 顶部提示条 */
export function notice(text, kind = 'info') {
  if (!text) {
    el.noticeBar.hidden = true
    return
  }
  el.noticeBar.textContent = text
  el.noticeBar.dataset.kind = kind
  el.noticeBar.hidden = false
}

/** 切换模式显示（含整页情绪配色） */
export function setMode(mode) {
  const meta = MODE_META[mode] ?? MODE_META.daily
  el.modeChip.textContent = meta.label
  el.modeChip.dataset.mode = mode
  el.moodLabel.textContent = meta.status
  document.body.dataset.mood = meta.mood
}

export function scrollToEnd() {
  requestAnimationFrame(() => {
    el.chat.scrollTop = el.chat.scrollHeight
  })
}

/** 输入框高度跟随内容 */
export function autoGrow() {
  el.input.style.height = 'auto'
  el.input.style.height = `${Math.min(el.input.scrollHeight, 132)}px`
}

export function openSheet() {
  el.sheet.hidden = false
  el.sheetMask.hidden = false
}

export function closeSheet() {
  el.sheet.hidden = true
  el.sheetMask.hidden = true
}

export function setBusy(busy) {
  el.btnSend.disabled = busy
  el.input.disabled = busy
}

/* ── 输入框与消息区的封装 ──
 * main.js 一律通过这些函数操作 DOM。
 * 之前 main.js 直接写 ui.input / ui.el.chat，而 ui.js 只导出 el 对象，
 * 导致 ui.input 是 undefined，一点发送就抛 TypeError：
 * 消息发不出去、输入框也清不掉。封装后这类错误不会再出现。 */

export function getInput() {
  return el.input.value
}

export function clearInput() {
  el.input.value = ''
  autoGrow()
}

export function focusInput() {
  el.input.focus()
}

/** 清空整个消息区，并把欢迎页放回来 */
export function clearChat() {
  el.chat.innerHTML = ''
}

export function showWelcome(show = true) {
  el.welcome.hidden = !show
}

/** 设置提示条文本，别名便于语义化调用 */
export function setNotice(text, kind = 'info') {
  notice(text, kind)
}

/** 回填历史消息（刷新页面后接着聊） */
export function restoreHistory(history) {
  if (!history.length) return
  el.welcome.hidden = true
  for (const m of history) {
    if (m.type === 'note') pushSystemNote(m.text)
    else pushMessage(m.who, m.text)
  }
  scrollToEnd()
}
