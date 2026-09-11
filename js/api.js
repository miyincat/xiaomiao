/**
 * 【网络层】DeepSeek 接口调用
 *
 * 关于跨域：官方接口是否允许浏览器直连，取决于对方的 CORS 配置。
 * 本文件不假设它一定放行 —— 一旦被浏览器拦下，会给出人话解释，
 * 并把「接口地址」暴露在设置里，方便换成自建代理。
 */

/**
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {string} opts.apiBase
 * @param {string} opts.model
 * @param {string} opts.system
 * @param {Array<{role:string,content:string}>} opts.messages
 * @returns {Promise<string>} 模型回复文本
 */
export async function chat({ apiKey, apiBase, model, system, messages }) {
  if (!apiKey) throw new Error('NO_KEY')

  const base = String(apiBase || 'https://api.deepseek.com').replace(/\/+$/, '')
  const url = `${base}/chat/completions`

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: system }, ...messages],
        temperature: 1.1,
        max_tokens: 400,
        stream: false,
      }),
    })
  } catch (err) {
    // fetch 抛错 = 请求根本没发出去，最常见原因就是 CORS 或网络不通
    const e = new Error('NETWORK')
    e.detail = String(err?.message ?? err)
    throw e
  }

  if (!res.ok) {
    let detail = ''
    try {
      const body = await res.json()
      detail = body?.error?.message ?? JSON.stringify(body)
    } catch {
      detail = await res.text().catch(() => '')
    }
    const e = new Error(res.status === 401 ? 'BAD_KEY' : 'HTTP_ERROR')
    e.status = res.status
    e.detail = detail
    throw e
  }

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    const e = new Error('EMPTY')
    e.detail = JSON.stringify(data).slice(0, 300)
    throw e
  }
  return text.trim()
}

/** 把内部错误码翻译成给用户看的人话 */
export function explainError(err) {
  switch (err?.message) {
    case 'NO_KEY':
      return { kind: 'error', text: '还没有填 API Key 呢。点右上角齿轮，把 Key 填进去就好啦。' }
    case 'BAD_KEY':
      return { kind: 'error', text: `API Key 好像不对（401）。再检查一下有没有复制完整。 ${err.detail ?? ''}` }
    case 'NETWORK':
      return {
        kind: 'error',
        text:
          '请求没能发出去。最常见的原因是浏览器跨域（CORS）被接口拒绝，' +
          '也可能是网络不通。可以在设置里把「接口地址」换成一个允许跨域的代理地址。',
      }
    case 'HTTP_ERROR':
      return { kind: 'error', text: `接口返回了 ${err.status}：${err.detail ?? ''}` }
    case 'EMPTY':
      return { kind: 'error', text: '接口返回了空内容，稍后再试一次吧。' }
    default:
      return { kind: 'error', text: `出了点小意外：${err?.message ?? err}` }
  }
}
