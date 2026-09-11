/**
 * 【配置与本地存储】
 *
 * 安全要点：API Key 只存在访问者自己的浏览器 localStorage 里，
 * 不会写进代码、不会提交进仓库、不会发送到除模型接口以外的任何地方。
 */

const K = {
  settings: 'xm.settings.v1',
  state: 'xm.state.v1',
  history: 'xm.history.v1',
}

/** 默认设置 */
const DEFAULTS = {
  apiKey: '',
  apiBase: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  memory: true,
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const val = JSON.parse(raw)
    return val ?? fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadSettings() {
  return { ...DEFAULTS, ...read(K.settings, {}) }
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch }
  write(K.settings, next)
  return next
}

export function loadState() {
  return { facts: [], topics: [], summary: '', mood: 'daily', ...read(K.state, {}) }
}

export function saveState(state) {
  write(K.state, state)
}

export function loadHistory() {
  const h = read(K.history, [])
  return Array.isArray(h) ? h : []
}

export function saveHistory(history) {
  // 只保留最近 60 条，避免 localStorage 膨胀
  write(K.history, history.slice(-60))
}

/** 重置对话记忆（保留设置），对应人设文档里的【重置】 */
export function resetMemory() {
  try {
    localStorage.removeItem(K.state)
    localStorage.removeItem(K.history)
  } catch {
    /* 忽略 */
  }
}

/** 清空一切，包括 API Key */
export function wipeAll() {
  try {
    Object.values(K).forEach((k) => localStorage.removeItem(k))
  } catch {
    /* 忽略 */
  }
}
