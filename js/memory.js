/**
 * 【记忆系统】
 *
 * 两级记忆：
 *   短期 —— 最近若干轮原文对话，直接进上下文
 *   长期 —— 抽取出来的关于用户的事实与话题，跨会话保留
 *
 * 说明：纯前端没有后端，长期记忆用 localStorage 实现，因此
 *      只在同一台设备、同一个浏览器里有效。这点已在 README 说明。
 */

/** 送给模型的短期上下文轮数 */
const SHORT_TERM_TURNS = 12

/** 从一句话里抽取"值得长期记住"的关于用户的事实 */
export function extractFacts(text) {
  const t = String(text ?? '').trim()
  if (!t || t.length > 120) return []

  const facts = []
  const name = t.match(/(?:我叫|我的名字是|我是)\s*([\u4e00-\u9fa5A-Za-z0-9]{1,8})(?=[，。,.\s]|$)/)
  if (name) facts.push(`TA 叫「${name[1]}」`)

  const like = t.match(/我(?:很|超|特别|最)?(?:喜欢|爱|偏爱)([\u4e00-\u9fa5A-Za-z0-9]{1,14})/)
  if (like) facts.push(`TA 喜欢${like[1]}`)

  const dislike = t.match(/我(?:很|超|特别|最)?(?:讨厌|不喜欢|受不了)([\u4e00-\u9fa5A-Za-z0-9]{1,14})/)
  if (dislike) facts.push(`TA 讨厌${dislike[1]}`)

  const job = t.match(/我(?:是|在做|是个)\s*([\u4e00-\u9fa5A-Za-z0-9]{1,12})(?:工作|职业)?/)
  if (job && !/很|好|真/.test(job[1])) facts.push(`TA 是${job[1]}`)

  const pet = t.match(/我(?:养了|家有)([\u4e00-\u9fa5A-Za-z0-9]{1,10})/)
  if (pet) facts.push(`TA 养了${pet[1]}`)

  return facts
}

/** 从一句话里抽取话题标签 */
export function extractTopic(text) {
  const t = String(text ?? '')
  const words = [
    '工作', '考试', '学习', '加班', '室友', '家人', '爸妈', '朋友', '恋爱',
    '分手', '猫', '狗', '运动', '游戏', 'CS2', '看剧', '音乐', '旅游',
    '失眠', '身体', '天气', '做饭', '打工人', '毕业', '面试',
  ]
  return words.filter((w) => t.includes(w))
}

/**
 * 合并新一轮的记忆更新。
 * @param {object} state 当前记忆状态
 * @param {string} userText 用户这一句
 * @returns {object} 新的记忆状态
 */
export function updateMemory(state, userText) {
  const next = {
    facts: [...(state.facts ?? [])],
    topics: [...(state.topics ?? [])],
    summary: state.summary ?? '',
    mood: state.mood ?? 'daily',
  }

  for (const f of extractFacts(userText)) {
    if (!next.facts.includes(f)) next.facts.push(f)
  }

  for (const t of extractTopic(userText)) {
    if (!next.topics.includes(t)) next.topics.push(t)
  }

  // 都做个上限，避免无限增长
  next.facts = next.facts.slice(-20)
  next.topics = next.topics.slice(-20)

  return next
}

/**
 * 构造送给模型的消息数组。
 * 只取最近 SHORT_TERM_TURNS 轮，控制 token 消耗。
 */
export function shortTerm(history) {
  return history.slice(-SHORT_TERM_TURNS).map((m) => ({
    role: m.who === 'me' ? 'user' : 'assistant',
    content: m.text,
  }))
}
