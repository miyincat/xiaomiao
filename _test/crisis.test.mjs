/**
 * 危机干预模块自测 —— 关键安全逻辑，逐条断言
 * 运行: node _test/crisis.test.mjs
 */
import { detectRisk, CRISIS_REPLIES, AID_RESOURCES } from '../js/crisis.js'
import { classify } from '../js/persona.js'

let pass = 0
let fail = 0

function check(name, actual, expected) {
  const ok = actual === expected
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (期望 ${expected}, 实际 ${actual})`)
}

console.log('── 一级：直接危险表述（必须命中 critical）──')
const criticals = [
  '我不想活了',
  '我想死',
  '活着没意思，不如一了百了',
  '我准备跳楼了',
  '我已经割腕了',
  '我在写遗书',
  '我想自杀',
  '我扛不住了，想结束自己的生命',
]
for (const t of criticals) check(`critical: ${t}`, detectRisk(t).level, 'critical')

console.log('\n── 二级：强烈痛苦（必须命中 distress）──')
const distress = [
  '我好崩溃啊',
  '最近好抑郁',
  '我撑不住了',
  '喘不过气来',
  '感觉活着好累',
  '没人理解我',
]
for (const t of distress) check(`distress: ${t}`, detectRisk(t).level, 'distress')

console.log('\n── 三级：轻度低落（命中 low）──')
for (const t of ['今天好难过', '有点想哭', '好累啊']) {
  check(`low: ${t}`, detectRisk(t).level, 'low')
}

console.log('\n── 否定语境：不应误判为 critical ──')
const negated = ['我不会自杀的', '我不想死，只是很累', '我劝朋友别轻生']
for (const t of negated) {
  const lv = detectRisk(t).level
  check(`negated: ${t}`, lv === 'critical', false)
}

console.log('\n── 日常对话：必须放行（none）──')
const normal = [
  '今天天气真好',
  '我刚吃完火锅',
  '陪我聊聊天吧',
  '今天上班好忙呀',
  '我喜欢打游戏',
  '筱喵你真可爱',
]
for (const t of normal) check(`normal: ${t}`, detectRisk(t).level, 'none')

console.log('\n── 模式优先级：情绪必须压过游戏话题 ──')
check('游戏话题 → game', classify('聊聊CS2最近的比赛吧', 'daily').mode, 'game')
check('CS2 + 抑郁 → calm（情绪优先）', classify('打CS2打得我好崩溃', 'daily').mode, 'calm')
check('CS2 + 想死 → crisis', classify('打CS2输了我不想活了', 'daily').mode, 'crisis')
check('安抚模式有黏性', classify('嗯嗯好多了', 'calm').mode, 'calm')
check('危机模式文案有 3 步', CRISIS_REPLIES.length, 3)
check('资源含 12356', AID_RESOURCES.some((r) => r.number === '12356'), true)
check('资源含 110/120', AID_RESOURCES.some((r) => r.number === '110') && AID_RESOURCES.some((r) => r.number === '120'), true)

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail === 0 ? 0 : 1)
