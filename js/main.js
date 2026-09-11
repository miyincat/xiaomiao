/**
 * 【入口】串联：人设引擎 → 记忆 → 网络 → 界面
 */

import * as ui from './ui.js'
import * as store from './config.js'
import { chat, explainError } from './api.js'
import { classify, buildSystem, MODE_META } from './persona.js'
import { updateMemory, shortTerm } from './memory.js'
import { CRISIS_REPLIES } from './crisis.js'

/** 运行时状态 */
let settings = store.loadSettings()
let memory = store.loadState()
let history = store.loadHistory()
let mode = 'daily'
let busy = false
/** 危机干预队列：保证三步法一定按顺序说完，不被打断 */
let crisisQueue = []
let crisisRunning = false

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 把一条消息写进历史并落盘 */
function record(entry) {
  history.push(entry)
  store.saveHistory(history)
}

/* ───────────── 危机干预流程（最高优先级，不经过模型） ───────────── */

async function runCrisisFlow() {
  if (crisisRunning) return
  crisisRunning = true

  while (crisisQueue.length) {
    const step = crisisQueue.shift()

    if (step.kind === 'reply') {
      ui.showTyping()
      await sleep(1100)
      ui.hideTyping()
      ui.pushMessage('her', step.text)
      record({ who: 'her', text: step.text })
    } else if (step.kind === 'card') {
      await sleep(500)
      ui.pushAidCard()
      ui.pushSystemNote('注：以上号码为全国通用紧急资源')
    }
  }

  crisisRunning = false
}

function enterCrisis() {
  mode = 'crisis'
  ui.setMode('crisis')
  ui.notice('喵会好好陪着你。下面这些话，我想认真说完。', 'calm')

  crisisQueue.push({ kind: 'reply', text: CRISIS_REPLIES[0] })
  crisisQueue.push({ kind: 'reply', text: CRISIS_REPLIES[1] })
  crisisQueue.push({ kind: 'reply', text: CRISIS_REPLIES[2] })
  crisisQueue.push({ kind: 'card' })

  void runCrisisFlow()
}

/* ───────────── 普通对话流程 ───────────── */

async function runChat(userText) {
  ui.showTyping()

  const system = buildSystem(mode, memory)
  const messages = [...shortTerm(history), { role: 'user', content: userText }]

  try {
    const reply = await chat({
      apiKey: settings.apiKey,
      apiBase: settings.apiBase,
      model: settings.model,
      system,
      messages,
    })
    ui.hideTyping()
    ui.pushMessage('her', reply)
    record({ who: 'her', text: reply })
  } catch (err) {
    ui.hideTyping()
    const e = explainError(err)
    ui.notice(e.text, e.kind)
    // 这一轮失败了，把这个孤立的用户消息从历史里摘掉，
    // 否则刷新后上下文里会出现一条没有回复的问句
    let idx = -1
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].who === 'me' && history[i].text === userText) {
        idx = i
        break
      }
    }
    if (idx !== -1) {
      history.splice(idx, 1)
      store.saveHistory(history)
    }
  }
}

/* ───────────── 主流程 ───────────── */

export async function handleSend(rawText) {
  const text = String(rawText ?? '').trim()
  if (!text || busy) return

  // 【重置】指令
  if (text === '【重置】' || text === '重置') {
    doReset()
    return
  }

  busy = true
  ui.setBusy(true)
  ui.notice('')

  ui.pushMessage('me', text)
  record({ who: 'me', text })
  ui.clearInput()

  // 1) 先算模式（在模型之外判定，不依赖模型自觉）
  const result = classify(text, mode)
  const changed = result.mode !== mode
  mode = result.mode
  ui.setMode(mode)

  if (changed && mode === 'calm') {
    ui.notice('喵感觉你今天有点沉。我们慢慢说，不着急。', 'calm')
  } else if (changed && mode === 'game' && result.risk === 'none') {
    ui.notice('切换：游戏模式 —— 眼睛发亮中', 'info')
  }

  // 2) 记忆更新
  if (settings.memory) {
    memory = updateMemory(memory, text)
    memory.mood = mode
    store.saveState(memory)
  }

  // 3) 分流：危机走硬编码兜底，其余走模型
  if (result.mode === 'crisis') {
    enterCrisis()
  } else {
    await runChat(text)
  }

  busy = false
  ui.setBusy(false)
  ui.focusInput()
}

/** 重置全部对话记忆 */
export function doReset() {
  store.resetMemory()
  memory = store.loadState()
  history = []
  crisisQueue = []
  crisisRunning = false
  mode = 'daily'

  ui.clearChat()
  ui.setMode('daily')
  ui.setNotice('')
  ui.pushSystemNote('记忆已清空，我们重新认识一次吧')
  ui.showWelcome(false)

  const hello = '唔……我们好像第一次见面？\n我是筱喵。（耳朵竖起来，好奇地看着你）今天想聊点什么呀？'
  ui.pushMessage('her', hello)
  record({ who: 'her', text: hello })
}

/* ───────────── 设置面板 ───────────── */

function syncSettingsUI() {
  ui.el.apiKey.value = settings.apiKey
  ui.el.apiBase.value = settings.apiBase
  ui.el.modelPick.value = settings.model
  ui.el.memoryToggle.checked = Boolean(settings.memory)
  ui.el.keyHint.textContent = settings.apiKey
    ? '已保存。只存在这个浏览器里。'
    : '只保存在你自己的浏览器里，不会上传到任何服务器。'
}

function bindSettings() {
  ui.el.apiKey.addEventListener('change', () => {
    settings = store.saveSettings({ apiKey: ui.el.apiKey.value.trim() })
    syncSettingsUI()
  })

  ui.el.apiBase.addEventListener('change', () => {
    settings = store.saveSettings({ apiBase: ui.el.apiBase.value.trim() || 'https://api.deepseek.com' })
    syncSettingsUI()
  })

  ui.el.modelPick.addEventListener('change', () => {
    settings = store.saveSettings({ model: ui.el.modelPick.value })
  })

  ui.el.memoryToggle.addEventListener('change', () => {
    settings = store.saveSettings({ memory: ui.el.memoryToggle.checked })
  })

  ui.el.btnSettings.addEventListener('click', ui.openSheet)
  ui.el.btnCloseSheet.addEventListener('click', ui.closeSheet)
  ui.el.sheetMask.addEventListener('click', ui.closeSheet)

  ui.el.btnWipe.addEventListener('click', () => {
    store.wipeAll()
    settings = store.loadSettings()
    memory = store.loadState()
    history = []
    ui.clearChat()
    syncSettingsUI()
    ui.closeSheet()
    ui.setNotice('已经全部清空啦，包括 API Key。', 'info')
    ui.setMode('daily')
    ui.showWelcome(true)
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !ui.el.sheet.hidden) ui.closeSheet()
  })
}

/* ───────────── 启动 ───────────── */

function boot() {
  ui.setMode('daily')
  bindSettings()
  syncSettingsUI()

  // 欢迎页的快捷话题
  ui.el.welcomeHints.addEventListener('click', (e) => {
    const chip = e.target.closest('.hint-chip')
    if (chip?.dataset.fill) void handleSend(chip.dataset.fill)
  })

  // 发送
  ui.el.btnSend.addEventListener('click', () => void handleSend(ui.el.input.value))
  ui.el.btnReset.addEventListener('click', doReset)

  ui.el.input.addEventListener('input', ui.autoGrow)
  ui.el.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      void handleSend(ui.el.input.value)
    }
  })

  // 回填历史
  ui.restoreHistory(history)

  // 首次使用引导
  if (!settings.apiKey) {
    ui.setNotice('第一次使用：点右上角齿轮，填入自己的 DeepSeek API Key 就能开始聊天了。', 'info')
    ui.clearChat()
    ui.showWelcome(true)
  } else if (history.length) {
    ui.setMode(memory.mood ?? 'daily')
  }
}

boot()

// 便于排查问题，暴露到控制台
window.__xiaomiao = { get settings() { return settings }, get memory() { return memory }, get mode() { return mode }, MODE_META }
