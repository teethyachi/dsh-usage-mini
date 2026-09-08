/**
 * dsh-usage-mini — floating usage mini-window for the dsh web GUI, with a
 * control card in the DSH Settings page (显示/隐藏开关 + 立即刷新).
 *
 * Content rules (per user request):
 *  - Subscription models (ChatGPT/Codex, Claude via dsh-plugin-subscriptions):
 *    show each usage window's used/remaining percent and the next reset time.
 *    NEVER show balance or today's money spend here.
 *  - API-billed DeepSeek Flash (official open platform): show today's spend
 *    (money) and the account balance. Uses dsh-cost-meter's ledger + official
 *    balance cache through the Typert HTTP gateway.
 *
 * Data transport is plain same-origin POST (no ctx services for data):
 *  - Typert unary:   POST /api/<service>/<method>
 *  - Subscriptions:  POST /subscriptions-auth/<endpoint>   (Connection RPC)
 * Both answer the client-request envelope:
 *   { type:'client-request', rpcId, method, payload } →
 *   { type:'server-response', rpcId, result:{ ok:true, value } | { ok:false, error } }
 *
 * The DSH Settings card is registered through the standard `settings.section`
 * slot (ctx.slots), same mechanism cost-meter/subscriptions use.
 */
window.__ModuleLoader__.load({
  id: 'dsh-usage-mini',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')

    const UID = 'dsh-usage-mini'
    const LS_UI = 'dsh-usage-mini:ui'
    const AUTO_REFRESH_MS = 60 * 1000
    const EVT_SET = 'dsh-usage-mini:set'        // { visible?: boolean }
    const EVT_REFRESH = 'dsh-usage-mini:refresh' // { force?: boolean }

    // ── feedback (opens a pre-filled GitHub issue; no network call from here) ──
    const PLUGIN_VERSION = '0.1.4'
    const FEEDBACK_REPO = 'teethyachi/dsh-usage-mini'
    const FEEDBACK_MAX_CHARS = 500
    const FEEDBACK_COOLDOWN_MS = 60 * 1000
    const LS_FEEDBACK = 'dsh-usage-mini:feedback'
    const FEEDBACK_PROMPT = '给点儿意见？'

    const PROVIDERS = [
      { id: 'codex', name: 'Codex (ChatGPT)' },
      { id: 'claude', name: 'Claude' },
    ]
    const OFFICIAL_PROVIDERS = new Set(['deepseek', 'deepseek-official'])
    const FLASH_MODEL = 'deepseek-v4-flash'

    // Corner-dock geometry.
    const CORNER_GAP = 14            // collapsed bar inset from the screen edge.
    const EXPAND_GAP = 16            // expanded window inset when corner-anchored.
    const CORNER_ID = { bl: 'bl', br: 'br', tl: 'tl', tr: 'tr' }

    // ── tiny helpers ─────────────────────────────────────────────────────────

    const num = (v) => {
      const n = Number(v)
      return Number.isFinite(n) && n > 0 ? n : 0
    }

    function uuid() {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })
    }

    function el(tag, props, ...children) {
      const node = document.createElement(tag)
      if (props) {
        for (const key of Object.keys(props)) {
          const value = props[key]
          if (key === 'class') node.className = value
          else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value)
          else if (key === 'title' || key === 'data-tip') node.title = value
          else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value)
          } else if (value !== null && value !== undefined && value !== false) {
            node.setAttribute(key, value === true ? '' : String(value))
          }
        }
      }
      for (const child of children) {
        if (child === null || child === undefined || child === false) continue
        node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child)
      }
      return node
    }

    async function rpcPost(url, method, payload) {
      const rpcId = uuid()
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId, method, payload }),
      })
      if (res.status === 404) {
        const err = new Error('RPC 通道不存在 (HTTP 404)')
        err.notFound = true
        throw err
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const env = await res.json()
      if (!env || env.type !== 'server-response' || env.rpcId !== rpcId) throw new Error('RPC 响应异常')
      const result = env.result
      if (!result || result.ok !== true) {
        const msg = result && result.error && result.error.message ? result.error.message : 'RPC 调用失败'
        throw new Error(msg)
      }
      return result.value
    }

    function defaultConfig() {
      return { symbol: '¥', decimals: 4, exchangeRate: 7.2, currency: 'CNY' }
    }

    /** Display a value already in the display/bookkeeping currency (e.g. official balance CNY). */
    function fmtMoneyValue(value, cfg) {
      const symbol = (cfg && typeof cfg.symbol === 'string' && cfg.symbol.length > 0) ? cfg.symbol : '¥'
      const decimals = Math.max(0, Math.min(10, Math.floor(Number(cfg && cfg.decimals) || 2)))
      let effective = decimals
      if (value > 0 && value < Math.pow(10, -decimals)) effective = decimals + 2
      let fixed = value.toFixed(effective)
      if (fixed.includes('.')) fixed = fixed.replace(/0+$/, '').replace(/\.$/, '')
      return symbol + fixed
    }

    /** Convert an USD ledger amount to the display currency and format it. */
    function fmtUsd(usd, cfg) {
      const rate = Number(cfg && cfg.exchangeRate)
      const value = usd * (Number.isFinite(rate) && rate > 0 ? rate : 1)
      return fmtMoneyValue(value, cfg)
    }

    /** Official balance is already in the bookkeeping currency — no rate conversion. */
    function fmtBalance(value, cfg) {
      return fmtMoneyValue(value, cfg)
    }

    function fmtReset(epochMs) {
      if (!Number.isFinite(epochMs) || epochMs <= 0) return { date: '', rel: '' }
      const d = new Date(epochMs)
      const pad = (x) => String(x).padStart(2, '0')
      const date = `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
      const diffSec = Math.round((epochMs - Date.now()) / 1000)
      let rel = ''
      if (diffSec <= 0) rel = '即将重置'
      else if (diffSec < 60) rel = '约 1 分钟内重置'
      else if (diffSec < 3600) rel = `约 ${Math.ceil(diffSec / 60)} 分钟后重置`
      else if (diffSec < 86400) {
        const h = Math.floor(diffSec / 3600)
        const m = Math.round((diffSec % 3600) / 60)
        rel = m > 0 ? `约 ${h} 小时 ${m} 分后重置` : `约 ${h} 小时后重置`
      } else {
        const days = Math.floor(diffSec / 86400)
        const h = Math.round((diffSec % 86400) / 3600)
        rel = h > 0 ? `约 ${days} 天 ${h} 小时后重置` : `约 ${days} 天后重置`
      }
      return { date, rel }
    }

    function barColor(usedPercent) {
      if (usedPercent >= 95) return 'var(--dsw-alias-state-error-primary, #f85149)'
      if (usedPercent >= 80) return 'var(--dsw-alias-state-warn-primary, #f5a623)'
      return 'var(--dsw-alias-state-success-primary, #3fb950)'
    }

    function clockText(date) {
      const pad = (x) => String(x).padStart(2, '0')
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

    // ── preferences (per browser; visible default ON) ────────────────────────

    let uiPrefs = { visible: true, collapsed: false, collapsedCorner: 'br', expand: { mode: 'edge', corner: 'br' }, left: null, top: null }

    function loadPrefs() {
      try {
        const raw = window.localStorage.getItem(LS_UI)
        if (raw) {
          const parsed = JSON.parse(raw)
          const exp = parsed.expand && typeof parsed.expand === 'object' ? parsed.expand : {}
          uiPrefs = {
            visible: typeof parsed.visible === 'boolean' ? parsed.visible : true,
            collapsed: parsed.collapsed === true,
            collapsedCorner: typeof parsed.collapsedCorner === 'string' && parsed.collapsedCorner in CORNER_ID
              ? parsed.collapsedCorner
              : 'br',
            expand: {
              mode: exp.mode === 'custom' ? 'custom' : 'edge',
              corner: typeof exp.corner === 'string' && exp.corner in CORNER_ID ? exp.corner : 'br',
              left: typeof exp.left === 'number' && Number.isFinite(exp.left) ? exp.left : null,
              top: typeof exp.top === 'number' && Number.isFinite(exp.top) ? exp.top : null,
            },
            left: typeof parsed.left === 'number' && Number.isFinite(parsed.left) ? parsed.left : null,
            top: typeof parsed.top === 'number' && Number.isFinite(parsed.top) ? parsed.top : null,
          }
        }
      } catch { /* storage unavailable: keep defaults */ }
      return uiPrefs
    }

    function savePrefs() {
      try { window.localStorage.setItem(LS_UI, JSON.stringify(uiPrefs)) } catch { /* ignore */ }
    }

    function setVisiblePref(visible) {
      uiPrefs.visible = visible === true
      savePrefs()
    }

    // ── feedback helpers ─────────────────────────────────────────────────────
    // Pure: builds the GitHub "new issue" URL. The only user-derived payload is
    // the trimmed feedback text; the rest is the plugin version. Never include
    // usage numbers, balances, account identifiers or tokens.

    function buildFeedbackUrl(text, version) {
      const body = String(text || '').trim().slice(0, FEEDBACK_MAX_CHARS)
      if (!body) return null
      const ver = String(version || PLUGIN_VERSION)
      const params = new URLSearchParams()
      params.set('template', 'feedback.yml')
      params.set('labels', 'feedback')
      params.set('title', '[反馈] ' + body.split('\n')[0].slice(0, 60))
      params.set('feedback', body)
      params.set('version', ver)
      return 'https://github.com/' + FEEDBACK_REPO + '/issues/new?' + params.toString()
    }

    function loadFeedbackState() {
      try {
        const raw = window.localStorage.getItem(LS_FEEDBACK)
        if (raw) {
          const p = JSON.parse(raw)
          return {
            lastAt: typeof p.lastAt === 'number' ? p.lastAt : 0,
            count: typeof p.count === 'number' ? p.count : 0,
          }
        }
      } catch { /* ignore */ }
      return { lastAt: 0, count: 0 }
    }

    function saveFeedbackState(s) {
      try { window.localStorage.setItem(LS_FEEDBACK, JSON.stringify(s)) } catch { /* ignore */ }
    }

    // ── styles ────────────────────────────────────────────────────────────────

    const css = `
      #${UID}-root{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:min(302px,calc(100vw - 24px));
        font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:var(--dsw-alias-label-primary,#e6e9f0);
        background:var(--dsw-alias-bg-layer-2,rgba(22,24,30,.94));border:1px solid var(--dsw-alias-stroke-layer-2,rgba(255,255,255,.09));
        border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35);backdrop-filter:blur(8px);user-select:none;overflow:hidden}
      #${UID}-root *{box-sizing:border-box}
      .um-head{display:flex;align-items:center;gap:6px;height:30px;padding:0 8px 0 10px;cursor:grab;border-bottom:1px solid var(--dsw-alias-stroke-layer-1,rgba(255,255,255,.06))}
      .um-head:active{cursor:grabbing}
      .um-title{font-weight:600;font-size:12px;color:var(--dsw-alias-label-primary,#e6e9f0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
      .um-title .dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#3fb950);margin-right:6px;vertical-align:1px}
      .um-btn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#c3c9d6);cursor:pointer;font-size:12px;line-height:1;padding:0}
      .um-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#e6e9f0)}
      .um-btn.spin svg{animation:um-spin 0.8s linear infinite}
      @keyframes um-spin{to{transform:rotate(360deg)}}
      .um-body{padding:8px 10px 6px;max-height:min(70vh,560px);overflow:auto}
      .um-body::-webkit-scrollbar{width:6px}
      .um-body::-webkit-scrollbar-thumb{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.1));border-radius:3px}
      .um-sec{margin-bottom:8px}
      .um-sec:last-child{margin-bottom:0}
      .um-sec-title{display:flex;align-items:baseline;gap:6px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary,#c3c9d6);margin:2px 0 5px}
      .um-sec-title .um-tag{font-size:10px;font-weight:400;color:var(--dsw-alias-label-tertiary,#8b93a7)}
      .um-card{border:1px solid var(--dsw-alias-stroke-layer-1,rgba(255,255,255,.07));border-radius:9px;background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.025));padding:6px 8px;margin-bottom:6px}
      .um-card:last-child{margin-bottom:0}
      .um-card-head{display:flex;align-items:baseline;gap:6px;font-weight:600;font-size:12px;color:var(--dsw-alias-label-primary,#e6e9f0);margin-bottom:4px}
      .um-card-head .sub{font-weight:400;font-size:10px;color:var(--dsw-alias-label-tertiary,#8b93a7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;text-align:right}
      .um-row{display:flex;align-items:center;gap:6px;margin:3px 0 1px}
      .um-row .lbl{flex:none;width:86px;color:var(--dsw-alias-label-secondary,#c3c9d6);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .um-bar{flex:1;height:5px;border-radius:3px;background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.09));overflow:hidden}
      .um-fill{height:100%;border-radius:3px}
      .um-pct{flex:none;min-width:46px;text-align:right;font-size:11px;color:var(--dsw-alias-label-secondary,#c3c9d6);font-variant-numeric:tabular-nums}
      .um-row .um-pct strong{color:var(--dsw-alias-label-primary,#e6e9f0)}
      .um-sub{font-size:10px;color:var(--dsw-alias-label-tertiary,#8b93a7);margin:0 0 2px;font-variant-numeric:tabular-nums}
      .um-sub .ok{color:var(--dsw-alias-state-success-primary,#3fb950)}
      .um-kv{display:flex;justify-content:space-between;gap:8px;padding:2px 0;font-size:11px}
      .um-kv .k{color:var(--dsw-alias-label-secondary,#c3c9d6)}
      .um-kv .v{color:var(--dsw-alias-label-primary,#e6e9f0);font-variant-numeric:tabular-nums;font-weight:600}
      .um-kv .v.dim{color:var(--dsw-alias-label-tertiary,#8b93a7);font-weight:400}
      .um-note{font-size:10px;color:var(--dsw-alias-label-tertiary,#8b93a7);padding:2px 0;line-height:1.5}
      .um-note.err{color:var(--dsw-alias-state-error-primary,#f85149)}
      .um-note.warn{color:var(--dsw-alias-state-warn-primary,#f5a623)}
      .um-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10px;color:var(--dsw-alias-label-tertiary,#8b93a7);padding:4px 0 0;border-top:1px solid var(--dsw-alias-stroke-layer-1,rgba(255,255,255,.05));margin-top:2px}
      /* ---- minimized: shrink down into a slim bar (plugin name + expand key) ---- */
      #${UID}-root{--um-tab-dot:#3fb950}
      #${UID}-root.collapsed{left:auto;top:auto;right:auto;bottom:auto;width:auto;height:auto;background:var(--dsw-alias-bg-layer-2,rgba(22,24,30,.95));border:1px solid var(--dsw-alias-stroke-layer-2,rgba(255,255,255,.10));border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.35);backdrop-filter:blur(8px);overflow:hidden}
      #${UID}-root.collapsed .um-head,#${UID}-root.collapsed .um-body,#${UID}-root.collapsed .um-foot{display:none}
      #${UID}-root .um-tab{display:none}
      #${UID}-root.collapsed .um-tab{display:flex}
      .um-tab{align-items:center;gap:8px;height:34px;padding:0 6px 0 13px;cursor:grab;white-space:nowrap;box-sizing:border-box}
      .um-tab:active{cursor:grabbing}
      .um-tab-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--um-tab-dot,#3fb950);animation:um-blink 1.9s ease-in-out infinite}
      @keyframes um-blink{0%,100%{opacity:1}50%{opacity:.3}}
      .um-tab-name{flex:none;font-weight:600;font-size:12px;color:var(--dsw-alias-label-primary,#e6e9f0);line-height:1}
      .um-tab-open{flex:none;position:relative;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;border:0;color:#fff;cursor:pointer;background:radial-gradient(120% 130% at 28% 18%,rgba(255,255,255,.32),rgba(255,255,255,0) 46%),linear-gradient(155deg,var(--dsw-alias-brand-primary,#4c8dff),#2e5fd7);box-shadow:0 0 8px rgba(80,140,255,.55),0 2px 6px rgba(10,20,60,.35);transition:transform .15s ease,box-shadow .15s ease;animation:um-breathe 2.4s ease-in-out infinite}
      .um-tab-open:hover{transform:scale(1.14);box-shadow:0 0 14px rgba(95,155,255,.95),0 2px 8px rgba(10,20,60,.4)}
      .um-tab-open:active{transform:scale(.94)}
      .um-tab-open svg{width:13px;height:13px}
      @keyframes um-breathe{0%,100%{box-shadow:0 0 6px rgba(80,140,255,.4),0 2px 6px rgba(10,20,60,.3)}50%{box-shadow:0 0 15px rgba(95,155,255,.95),0 2px 7px rgba(10,20,60,.38)}}
      /* ---- feedback bar (expanded window only) ---- */
      .um-fb{display:flex;align-items:center;gap:6px;padding:6px 0 0;margin-top:6px;border-top:1px solid var(--dsw-alias-stroke-layer-1,rgba(255,255,255,.05))}
      .um-fb-input{flex:1;min-width:0;height:24px;padding:0 8px;border-radius:7px;border:1px solid var(--dsw-alias-stroke-layer-2,rgba(255,255,255,.10));background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.03));color:var(--dsw-alias-label-primary,#e6e9f0);font:11px/1 inherit;font-family:inherit;outline:none;user-select:text}
      .um-fb-input::placeholder{color:var(--dsw-alias-label-tertiary,#8b93a7);font-style:italic;opacity:.8}
      .um-fb-input:focus{border-color:var(--dsw-alias-brand-primary,#4c8dff)}
      .um-fb-send{flex:none;height:24px;padding:0 9px;border-radius:7px;border:0;background:var(--dsw-alias-brand-primary,#4c8dff);color:#fff;font-size:11px;cursor:pointer;white-space:nowrap}
      .um-fb-send:disabled{opacity:.45;cursor:default}
      .um-fb-send:not(:disabled):hover{filter:brightness(1.1)}
      .um-fb-msg{font-size:10px;color:var(--dsw-alias-label-tertiary,#8b93a7);padding:3px 0 0;min-height:14px;line-height:1.4}
      .um-fb-msg.ok{color:var(--dsw-alias-state-success-primary,#3fb950)}
      .um-fb-msg a{color:var(--dsw-alias-brand-primary,#4c8dff);text-decoration:none}
      /* ---- settings card ---- */
      .ums-card{font:12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:var(--dsw-alias-label-primary,#e6e9f0);max-width:640px}
      .ums-card .ums-desc{color:var(--dsw-alias-label-secondary,#c3c9d6);margin:2px 0 10px}
      .ums-card .ums-desc small{color:var(--dsw-alias-label-tertiary,#8b93a7)}
      .ums-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--dsw-alias-stroke-layer-1,rgba(255,255,255,.06))}
      .ums-row:first-of-type{border-top:0}
      .ums-row .ums-main{min-width:0}
      .ums-row .ums-name{font-weight:600;color:var(--dsw-alias-label-primary,#e6e9f0)}
      .ums-row .ums-hint{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a7)}
      .ums-actions{display:flex;align-items:center;gap:8px;flex:none}
      .ums-switch{position:relative;flex:none;width:34px;height:18px;border-radius:9px;background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.12));cursor:pointer;transition:background .15s;border:0;padding:0}
      .ums-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary,#4c8dff)}
      .ums-switch .knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s}
      .ums-switch[aria-checked="true"] .knob{left:18px}
      .ums-btn{flex:none;display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:7px;border:1px solid var(--dsw-alias-stroke-layer-2,rgba(255,255,255,.12));background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.04));color:var(--dsw-alias-label-primary,#e6e9f0);cursor:pointer;font-size:12px}
      .ums-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.09))}
      .ums-status{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b93a7)}
    `

    function ensureStyle() {
      if (!document.getElementById(`${UID}-style`)) {
        const style = el('style', { id: `${UID}-style`, 'data-plugin': UID }, css)
        document.head.appendChild(style)
      }
    }

    // ── data fetching ────────────────────────────────────────────────────────

    const view = {
      loading: true,
      subsError: null,
      apiError: null,
      api: null,
      subs: null,
      lastAt: 0,
    }

    async function fetchSubs(force) {
      const status = await rpcPost('/subscriptions-auth/status', 'status', {})
      const byProvider = (status && status.providers) || {}
      const list = []
      for (const meta of PROVIDERS) {
        const entry = byProvider[meta.id]
        const accounts = (entry && Array.isArray(entry.accounts) ? entry.accounts : [])
        const accRows = []
        for (const acc of accounts) {
          const row = {
            key: acc.key,
            label: acc.account || acc.key,
            plan: acc.plan || '',
            windows: [],
            error: null,
            ok: false,
          }
          try {
            const usage = await rpcPost('/subscriptions-auth/usage', 'usage', {
              provider: meta.id,
              account: acc.key,
              ...(force ? { force: true } : {}),
            })
            row.ok = Boolean(usage && usage.supported !== false)
            row.windows = Array.isArray(usage && usage.windows) ? usage.windows : []
            row.plan = row.plan || (usage && usage.plan) || ''
          } catch (err) {
            row.error = err && err.message ? err.message : String(err)
          }
          accRows.push(row)
        }
        list.push({ ...meta, accounts: accRows })
      }
      return list
    }

    async function fetchApi(force) {
      let stateData = await rpcPost('/api/costMeter/getState', 'costMeter/getState', { args: {} })
      if (!stateData || typeof stateData !== 'object') throw new Error('cost-meter 返回了空状态')
      const balanceNow = stateData.balance || {}
      const neverFetched = balanceNow.status !== 'ok' && !(Number(balanceNow.fetchedAt) > 0)
      // Auto-refresh only when the official balance was never fetched yet (fresh boot or
      // cost-meter not opened); otherwise keep the cached snapshot and let the manual
      // refresh button force a live re-check. This avoids hammering the balance API.
      if (force || (balanceNow.status !== 'ok' && neverFetched)) {
        try {
          const refreshed = await rpcPost('/api/costMeter/refreshBalance', 'costMeter/refreshBalance', { args: {} })
          if (refreshed && refreshed.state && typeof refreshed.state === 'object') {
            stateData = refreshed.state
          }
        } catch {
          /* keep the previous snapshot; its balance.message explains the state */
        }
      }
      const today = stateData.today && typeof stateData.today === 'object' ? stateData.today : { cost: 0, calls: 0, byProviderModel: {} }
      const by = (today.byProviderModel && typeof today.byProviderModel === 'object') ? today.byProviderModel : {}
      let officialUsd = 0
      let officialCalls = 0
      let flashUsd = 0
      let flashCalls = 0
      const keys = Object.keys(by)
      for (const key of keys) {
        const idx = key.indexOf(':')
        const provider = idx >= 0 ? key.slice(0, idx) : key
        const model = idx >= 0 ? key.slice(idx + 1) : ''
        if (!OFFICIAL_PROVIDERS.has(provider)) continue
        const entry = by[key] || {}
        const cost = num(entry.cost)
        const calls = num(entry.calls)
        officialUsd += cost
        officialCalls += calls
        if (model === FLASH_MODEL) {
          flashUsd += cost
          flashCalls += calls
        }
      }
      const balance = stateData.balance || { status: 'off', message: '', totalBalance: 0, grantedBalance: 0, toppedUpBalance: 0, fetchedAt: 0 }
      return {
        balance,
        todayUsd: officialUsd,
        todayCalls: officialCalls,
        flashUsd,
        flashCalls,
        hasBreakdown: keys.length > 0,
        config: stateData.config || defaultConfig(),
      }
    }

    // ── floating window UI (vanilla DOM) ─────────────────────────────────────

    let root = null
    let headTitle = null
    let subsBox = null
    let apiBox = null
    let footEl = null
    let refreshBtn = null
    let autoTimer = null
    let visibilityHandler = null
    let tabBar = null
    let suppressTabClick = false
    let animBusy = false

    function buildStructure() {
      ensureStyle()
      root = el('div', { id: `${UID}-root`, class: uiPrefs.collapsed ? 'collapsed' : '' })

      function svgBtn(svg, title, fn) {
        const b = el('button', { class: 'um-btn', title, type: 'button' })
        b.addEventListener('click', (e) => { e.stopPropagation(); fn(e) })
        b.innerHTML = svg
        return b
      }

      headTitle = el('span', { class: 'um-title' })
      const dot = el('span', { class: 'dot' })
      headTitle.appendChild(dot)

      const refreshIcon = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9"/><path d="M13.5 1.8v3.4h-3.4"/></svg>'
      refreshBtn = svgBtn(refreshIcon, '立即刷新', () => { refresh(true) })

      const minimizeIcon = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 9.5 8 4 2.5 9.5"/><path d="M3.5 12.5h9"/></svg>'
      const minimizeBtn = svgBtn(minimizeIcon, '最小化收起', () => { setCollapsed(true) })

      const head = el('div', { class: 'um-head', title: '拖拽移动 · 60 秒自动刷新' })
      head.appendChild(headTitle)
      head.appendChild(minimizeBtn)
      head.appendChild(refreshBtn)

      const bodyEl = el('div', { class: 'um-body' })
      const sec1 = el('div', { class: 'um-sec' },
        el('div', { class: 'um-sec-title' }, '订阅模型', el('span', { class: 'um-tag' }, '仅用量与重置 · 不显示余额/花费')),
        (subsBox = el('div')),
      )
      const sec2 = el('div', { class: 'um-sec' },
        el('div', { class: 'um-sec-title' }, 'DeepSeek Flash（官方 API）'),
        (apiBox = el('div')),
      )
      bodyEl.appendChild(sec1)
      bodyEl.appendChild(sec2)

      footEl = el('div', { class: 'um-foot' })
      bodyEl.appendChild(footEl)
      bodyEl.appendChild(buildFeedbackBar())
      root.appendChild(head)
      root.appendChild(bodyEl)

      // Minimized slim bar: keeps the plugin name and a glowing expand key.
      const expandIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>'
      tabBar = el('div', { class: 'um-tab', title: '点我展开用量小窗' })
      const tabDot = el('span', { class: 'um-tab-dot' })
      const tabName = el('span', { class: 'um-tab-name' }, '用量小窗')
      const tabOpen = el('button', { class: 'um-tab-open', type: 'button', title: '展开用量小窗', 'aria-label': '展开用量小窗' })
      tabOpen.innerHTML = expandIcon
      tabOpen.addEventListener('click', (e) => { e.stopPropagation(); setCollapsed(false) })
      tabBar.appendChild(tabDot)
      tabBar.appendChild(tabName)
      tabBar.appendChild(tabOpen)
      root.appendChild(tabBar)

      // Expand must also work when the pointer-captured click lands on the root
      // (drag handling retargets click targets) — listen at root level, never only
      // on the inner tab/button.
      root.addEventListener('click', () => {
        if (!root.classList.contains('collapsed')) return
        if (suppressTabClick) { suppressTabClick = false; return }
        setCollapsed(false)
      })

      makeDraggable(root)
      updateWindowLabel()
      updateTabStatus()
    }

    // Feedback bar: one input + send. "Send" opens a pre-filled GitHub issue in
    // a new tab; nothing is transmitted by this plugin itself.
    function buildFeedbackBar() {
      const wrap = el('div')
      const input = el('input', {
        class: 'um-fb-input',
        type: 'text',
        maxlength: String(FEEDBACK_MAX_CHARS),
        placeholder: FEEDBACK_PROMPT,
        'aria-label': '反馈',
        autocomplete: 'off',
      })
      const send = el('button', { class: 'um-fb-send', type: 'button', title: '在 GitHub 打开预填好的反馈（需 GitHub 登录）' }, '发送')
      const msg = el('div', { class: 'um-fb-msg' })
      const bar = el('div', { class: 'um-fb' }, input, send)
      wrap.appendChild(bar)
      wrap.appendChild(msg)

      // Keep typing/selection inside the input from being eaten by the drag handler.
      for (const evt of ['pointerdown', 'mousedown', 'click', 'keydown']) {
        input.addEventListener(evt, (e) => e.stopPropagation())
      }
      send.addEventListener('pointerdown', (e) => e.stopPropagation())

      const submit = () => {
        const text = input.value.trim()
        if (!text) { msg.className = 'um-fb-msg'; msg.textContent = '写一句就行，哪怕只是「这里看不懂」。'; input.focus(); return }
        const st = loadFeedbackState()
        const wait = FEEDBACK_COOLDOWN_MS - (Date.now() - st.lastAt)
        if (wait > 0) { msg.className = 'um-fb-msg'; msg.textContent = `慢一点，${Math.ceil(wait / 1000)} 秒后再发。`; return }
        const url = buildFeedbackUrl(text, PLUGIN_VERSION)
        if (!url) return
        const next = { lastAt: Date.now(), count: st.count + 1 }
        saveFeedbackState(next)
        const win = window.open(url, '_blank', 'noopener,noreferrer')
        msg.className = 'um-fb-msg ok'
        msg.innerHTML = ''
        if (win) {
          msg.appendChild(document.createTextNode('已在 GitHub 打开，点「Submit」即可。谢谢！'))
        } else {
          const a = el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, '点这里打开')
          msg.appendChild(document.createTextNode('弹窗被拦截：'))
          msg.appendChild(a)
        }
        input.value = ''
      }
      send.addEventListener('click', (e) => { e.stopPropagation(); submit() })
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } })
      return wrap
    }

    function updateWindowLabel() {
      if (!headTitle) return
      headTitle.innerHTML = ''
      const dot = el('span', { class: 'dot' })
      headTitle.appendChild(dot)
      headTitle.appendChild(document.createTextNode('用量小窗'))
    }

    // ── corner-dock collapse / expand ────────────────────────────────────────

    function viewportSize() {
      return {
        width: (document.documentElement && document.documentElement.clientWidth) || window.innerWidth,
        height: (document.documentElement && document.documentElement.clientHeight) || window.innerHeight,
      }
    }

    function parsePx(value) {
      const n = parseFloat(value)
      return Number.isFinite(n) ? n : NaN
    }

    /** Current collapsed-bar size; falls back to a stable estimate. */
    function barSize() {
      if (!tabBar) return { width: 120, height: 36 }
      const r = tabBar.getBoundingClientRect()
      return { width: r.width > 0 ? r.width : 120, height: r.height > 0 ? r.height : 36 }
    }

    /** Dock target for the collapsed bar at a corner (CORNER_GAP from the edges). */
    function cornerRect(corner, bw, bh) {
      const v = viewportSize()
      const g = CORNER_GAP
      const left = corner === 'br' || corner === 'tr' ? v.width - g - bw : g
      const top = corner === 'br' || corner === 'bl' ? v.height - g - bh : g
      return {
        left: Math.max(0, left),
        top: Math.max(0, top),
        width: bw,
        height: bh,
      }
    }

    /** The corner nearest a rectangle's centre (tl | tr | bl | br). */
    function nearestCorner(rect) {
      const v = viewportSize()
      const horizontal = rect.left + rect.width / 2 < v.width / 2 ? 'l' : 'r'
      const vertical = rect.top + rect.height / 2 < v.height / 2 ? 't' : 'b'
      return vertical + horizontal
    }

    /** Learn the real collapsed-bar size while the window is still expanded (no paint). */
    function measureBarWhileExpanded() {
      if (!root || !tabBar) return { width: 120, height: 36 }
      const had = root.classList.contains('collapsed')
      root.classList.add('collapsed')
      const r = tabBar.getBoundingClientRect()
      if (!had) root.classList.remove('collapsed')
      return { width: Math.max(1, r.width), height: Math.max(1, r.height) }
    }

    function setBox(left, top, right, bottom) {
      // 'auto' (not '') overrides the stylesheet's default right/bottom so the
      // panel never stretches along an edge it is not anchored to.
      root.style.left = left === null || left === undefined ? 'auto' : `${left}px`
      root.style.top = top === null || top === undefined ? 'auto' : `${top}px`
      root.style.right = right === null || right === undefined ? 'auto' : `${right}px`
      root.style.bottom = bottom === null || bottom === undefined ? 'auto' : `${bottom}px`
    }

    /** Place the window after (re)mounting: dock the collapsed bar, or restore the expanded spot. */
    function finalizePlacement() {
      if (!root || !root.parentNode) return
      root.style.transform = ''
      if (uiPrefs.collapsed) {
        dockBarToCorner(uiPrefs.collapsedCorner || 'br')
      } else {
        applyExpandedLayout()
      }
    }

    /** Snap the collapsed bar into a screen corner. */
    function dockBarToCorner(corner) {
      if (!root || !tabBar) return
      const bar = barSize()
      const rect = cornerRect(corner, bar.width, bar.height)
      setBox(rect.left, rect.top, null, null)
      uiPrefs.collapsedCorner = corner
      savePrefs()
    }

    /** Remember where the window should come back to when expanding. */
    function snapshotExpandState() {
      if (!root) return
      const l = root.style.left
      const t = root.style.top
      const custom = typeof l === 'string' && l.length > 0 && l !== 'auto' && !l.endsWith('%')
        && typeof t === 'string' && t.length > 0 && t !== 'auto' && !t.endsWith('%')
      if (custom) {
        uiPrefs.expand = { mode: 'custom', left: parsePx(l), top: parsePx(t), corner: null }
      } else {
        uiPrefs.expand = { mode: 'edge', corner: uiPrefs.collapsedCorner || 'br', left: null, top: null }
      }
      savePrefs()
    }

    /** Apply the stored/derived expanded placement and return its rect. */
    function applyExpandedLayout() {
      root.classList.remove('collapsed')
      const exp = uiPrefs.expand && typeof uiPrefs.expand === 'object' ? uiPrefs.expand : {}
      if (exp.mode === 'custom' && Number.isFinite(Number(exp.left)) && Number.isFinite(Number(exp.top))) {
        setBox(Number(exp.left), Number(exp.top), null, null)
      } else {
        const corner = exp.corner in CORNER_ID ? exp.corner : (uiPrefs.collapsedCorner || 'br')
        const g = EXPAND_GAP
        if (corner === 'br') setBox(null, null, g, g)
        else if (corner === 'bl') setBox(g, null, null, g)
        else if (corner === 'tr') setBox(null, g, g, null)
        else setBox(g, g, null, null)
      }
      return root.getBoundingClientRect()
    }

    async function collapseWindow() {
      if (!root || root.classList.contains('collapsed') || animBusy) return
      animBusy = true
      try {
        snapshotExpandState()
        const A = root.getBoundingClientRect()
        const bar = measureBarWhileExpanded()
        const corner = nearestCorner(A)
        const B = cornerRect(corner, bar.width, bar.height)
        uiPrefs.collapsedCorner = corner
        if (root.animate) {
          root.style.transformOrigin = '0 0'
          const anim = root.animate([
            { transform: 'translate(0px,0px) scale(1,1)', opacity: 1 },
            {
              transform: `translate(${B.left - A.left}px, ${B.top - A.top}px) scale(${bar.width / A.width}, ${bar.height / A.height})`,
              opacity: 0.5,
            },
          ], { duration: 240, easing: 'cubic-bezier(.4,.05,.3,1)', fill: 'forwards' })
          try { await anim.finished } catch { /* cancelled */ }
          anim.cancel()
        }
        root.style.transformOrigin = ''
        root.style.transform = ''
        root.classList.add('collapsed')
        setBox(B.left, B.top, null, null)
        if (root.animate) {
          try {
            root.animate(
              [{ transform: 'scale(.9)', opacity: 0.25 }, { transform: 'scale(1)', opacity: 1 }],
              { duration: 120, easing: 'ease-out' },
            )
          } catch { /* noop */ }
        }
        uiPrefs.collapsed = true
        savePrefs()
        updateTabStatus()
      } finally {
        animBusy = false
      }
    }

    async function expandWindow() {
      if (!root || !root.classList.contains('collapsed') || animBusy) return
      animBusy = true
      try {
        const A = root.getBoundingClientRect() // bar rect
        // Measure the future expanded spot first (no paint yet), then restore bar.
        applyExpandedLayout()
        const B = root.getBoundingClientRect()
        root.classList.add('collapsed')
        const bar = barSize()
        const dock = cornerRect(uiPrefs.collapsedCorner || 'br', bar.width, bar.height)
        setBox(dock.left, dock.top, null, null)
        const dx = (B.left + B.width / 2) - (A.left + A.width / 2)
        const dy = (B.top + B.height / 2) - (A.top + A.height / 2)
        if (root.animate) {
          const anim = root.animate([
            { transform: 'translate(0px,0px) scale(1,1)', opacity: 1 },
            { transform: `translate(${dx}px, ${dy}px) scale(1.06,1.06)`, opacity: 0 },
          ], { duration: 170, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' })
          try { await anim.finished } catch { /* cancelled */ }
          anim.cancel()
        }
        root.style.transform = ''
        applyExpandedLayout()
        updateWindowLabel()
        render() // show the last snapshot immediately; the stale check below refreshes it
        if (root.animate) {
          try {
            await root.animate(
              [
                { transform: 'scale(.95) translateY(8px)', opacity: 0 },
                { transform: 'scale(1) translateY(0px)', opacity: 1 },
              ],
              { duration: 170, easing: 'cubic-bezier(.2,.8,.3,1)' },
            ).finished
          } catch { /* cancelled */ }
        }
        uiPrefs.collapsed = false
        savePrefs()
        updateTabStatus()
        if (view.lastAt === 0 || Date.now() - view.lastAt > AUTO_REFRESH_MS) void refresh(false)
      } finally {
        animBusy = false
      }
    }

    function setCollapsed(collapsed) {
      if (collapsed) void collapseWindow()
      else void expandWindow()
    }

    /** Most-consumed subscription window percent across logged accounts (null when none). */
    function worstUsedPercent() {
      let worst = null
      const subs = view.subs
      if (subs) {
        for (const provider of subs) {
          for (const acc of provider.accounts) {
            if (!acc.ok) continue
            for (const win of acc.windows) {
              const used = Number(win && win.usedPercent)
              if (Number.isFinite(used)) worst = worst === null ? used : Math.max(worst, used)
            }
          }
        }
      }
      return worst
    }

    function updateTabStatus() {
      if (!root || !tabBar) return
      const worst = worstUsedPercent()
      const pct = worst === null ? 0 : Math.min(100, Math.max(0, worst))
      const color = pct >= 95 ? '#f85149' : pct >= 80 ? '#f5a623' : '#3fb950'
      root.style.setProperty('--um-tab-dot', color)
      const tips = []
      if (worst === null) tips.push('订阅用量未知')
      else if (worst >= 95) tips.push(`订阅用量即将用尽：已用 ${Math.round(worst)}%`)
      else if (worst >= 80) tips.push(`订阅额度偏紧：已用 ${Math.round(worst)}%`)
      else tips.push(`订阅用量正常：最高已用 ${Math.round(worst)}%`)
      const apiOk = view.api && view.api.balance && view.api.balance.status === 'ok'
      if (apiOk && view.api) tips.push(`DeepSeek 今日 ${fmtUsd(view.api.todayUsd, view.api.config || defaultConfig())}`)
      tips.push('点我展开用量小窗')
      const summary = tips.join(' · ')
      root.title = summary
      tabBar.title = summary
    }

    function makeDraggable(handle) {
      let dragging = false
      let startX = 0
      let startY = 0
      let originLeft = 0
      let originTop = 0
      let moved = 0
      handle.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return
        const collapsed = root && root.classList.contains('collapsed')
        // Expanded: only the header row drags; minimized: the whole slim bar drags.
        if (!collapsed && !e.target.closest('.um-head')) return
        dragging = true
        moved = 0
        startX = e.clientX
        startY = e.clientY
        const rect = root.getBoundingClientRect()
        originLeft = rect.left
        originTop = rect.top
        root.style.right = 'auto'
        root.style.bottom = 'auto'
        root.style.left = `${originLeft}px`
        root.style.top = `${originTop}px`
        handle.setPointerCapture(e.pointerId)
      })
      handle.addEventListener('pointermove', (e) => {
        if (!dragging) return
        const dx = e.clientX - startX
        const dy = e.clientY - startY
        moved = Math.max(moved, Math.abs(dx) + Math.abs(dy))
        root.style.left = `${Math.max(0, originLeft + dx)}px`
        root.style.top = `${Math.max(0, originTop + dy)}px`
      })
      const end = (e) => {
        if (!dragging) return
        dragging = false
        try { handle.releasePointerCapture(e.pointerId) } catch { /* noop */ }
        // A real drag must not be treated as a click-to-expand on the minimized bar.
        if (moved > 6) {
          suppressTabClick = true
          window.setTimeout(() => { suppressTabClick = false }, 200)
        }
        if (root.classList.contains('collapsed')) {
          // Dock the bar to the nearest screen corner after dragging.
          const rect = root.getBoundingClientRect()
          dockBarToCorner(nearestCorner(rect))
        } else {
          uiPrefs.left = root.offsetLeft
          uiPrefs.top = root.offsetTop
          uiPrefs.expand = { mode: 'custom', left: root.offsetLeft, top: root.offsetTop, corner: null }
          savePrefs()
        }
      }
      handle.addEventListener('pointerup', end)
      handle.addEventListener('pointercancel', end)
    }

    function renderSubs() {
      subsBox.innerHTML = ''
      if (view.subsError) {
        subsBox.appendChild(el('div', { class: 'um-note err' }, view.subsError))
        return
      }
      if (!view.subs) {
        subsBox.appendChild(el('div', { class: 'um-note' }, '加载中…'))
        return
      }
      const logged = view.subs.filter((p) => p.accounts.length > 0)
      if (logged.length === 0) {
        subsBox.appendChild(el('div', { class: 'um-note warn' }, '未登录订阅账户（设置 → Subscriptions 登录 ChatGPT/Claude）'))
        return
      }
      for (const provider of logged) {
        for (const acc of provider.accounts) {
          const card = el('div', { class: 'um-card' })
          const headLabel = `${provider.name}`
          const headSubParts = []
          if (acc.plan) headSubParts.push(acc.plan)
          if (acc.label && acc.label !== acc.key) headSubParts.push(acc.label)
          card.appendChild(el('div', { class: 'um-card-head' }, headLabel, el('span', { class: 'sub' }, headSubParts.join(' · '))))
          if (acc.error) {
            card.appendChild(el('div', { class: 'um-note err' }, `用量查询失败：${acc.error}`))
          } else if (!acc.ok) {
            card.appendChild(el('div', { class: 'um-note' }, '该账户未返回用量窗口'))
          } else if (acc.windows.length === 0) {
            card.appendChild(el('div', { class: 'um-note' }, '暂无用量窗口数据'))
          } else {
            for (const win of acc.windows) {
              const used = Number(win.usedPercent)
              const pct = Number.isFinite(used) ? used : 0
              const kindLabel = win.kind === 'session' ? '5 小时窗口' : win.kind === 'weekly' ? '本周窗口' : (win.kind || '窗口')
              const scope = (win.scope !== undefined && win.scope !== null && win.scope !== '') ? ` · ${win.scope}` : ''
              const remaining = Math.max(0, 100 - pct)
              const row = el('div', { class: 'um-row' },
                el('span', { class: 'lbl', title: kindLabel + scope }, kindLabel + scope),
                el('span', { class: 'um-bar' }, el('span', { class: 'um-fill', style: { width: `${Math.min(100, Math.max(0, pct))}%`, background: barColor(pct) } })),
                el('span', { class: 'um-pct' }, el('strong', {}, `${Math.round(pct)}%`), ' 已用'),
              )
              card.appendChild(row)
              const resetInfo = fmtReset(Number(win.resetsAt))
              const subLine = el('div', { class: 'um-sub' })
              subLine.appendChild(el('span', { class: 'ok' }, `剩余 ${Math.round(remaining)}%`))
              if (resetInfo.date) {
                subLine.appendChild(document.createTextNode(` · 重置 ${resetInfo.date}`))
                if (resetInfo.rel) subLine.appendChild(el('span', {}, `（${resetInfo.rel}）`))
              } else {
                subLine.appendChild(document.createTextNode(' · 重置时间未知'))
              }
              card.appendChild(subLine)
            }
          }
          subsBox.appendChild(card)
        }
      }
    }

    function renderApi() {
      apiBox.innerHTML = ''
      if (view.apiError) {
        apiBox.appendChild(el('div', { class: 'um-note err' }, view.apiError))
        return
      }
      if (!view.api) {
        apiBox.appendChild(el('div', { class: 'um-note' }, '加载中…'))
        return
      }
      const cfg = view.api.config || defaultConfig()
      const balance = view.api.balance || {}
      if (balance.status === 'error') {
        apiBox.appendChild(el('div', { class: 'um-note warn' }, balance.message || '余额查询失败（可点刷新重试）'))
      } else if (balance.status === 'off') {
        apiBox.appendChild(el('div', { class: 'um-note' }, '余额未配置或未启用（今日消耗仍按账本显示）'))
      }

      const rows = el('div')
      const todayUsd = view.api.todayUsd || 0
      const tipParts = []
      if (view.api.hasBreakdown) {
        tipParts.push(`今日官方调用 ${view.api.todayCalls} 次`)
        if (view.api.flashCalls > 0) tipParts.push(`deepseek-v4-flash ${view.api.flashCalls} 次 / ${fmtUsd(view.api.flashUsd, cfg)}`)
      }
      rows.appendChild(el('div', { class: 'um-kv' },
        el('span', { class: 'k' }, '今日消耗（官方）'),
        el('span', { class: 'v', title: tipParts.join('；') }, fmtUsd(todayUsd, cfg)),
      ))
      if (view.api.hasBreakdown) {
        rows.appendChild(el('div', { class: 'um-kv' },
          el('span', { class: 'k' }, '今日调用'),
          el('span', { class: 'v dim' }, `${view.api.todayCalls} 次`),
        ))
      }
      if (balance.status === 'ok') {
        const balanceTip = []
        if (Number(balance.grantedBalance) > 0) balanceTip.push(`赠送 ${fmtBalance(num(balance.grantedBalance), cfg)}`)
        if (Number(balance.toppedUpBalance) > 0) balanceTip.push(`充值 ${fmtBalance(num(balance.toppedUpBalance), cfg)}`)
        rows.appendChild(el('div', { class: 'um-kv' },
          el('span', { class: 'k' }, '余额（总）'),
          el('span', { class: 'v', title: balanceTip.length > 0 ? balanceTip.join(' · ') : undefined }, fmtBalance(num(balance.totalBalance), cfg)),
        ))
      }
      apiBox.appendChild(rows)
    }

    function render() {
      if (!root || !root.parentNode) return
      updateWindowLabel()
      updateTabStatus()
      renderSubs()
      renderApi()
      const foot = []
      if (view.lastAt > 0) foot.push(`更新于 ${clockText(new Date(view.lastAt))}`)
      foot.push('60s 自动')
      footEl.textContent = foot.join(' · ')
    }

    // ── refresh orchestration ────────────────────────────────────────────────

    let refreshing = false

    async function refresh(force) {
      if (!root || !root.parentNode || refreshing) return
      refreshing = true
      if (refreshBtn) refreshBtn.classList.add('spin')
      try {
        const results = await Promise.allSettled([fetchSubs(Boolean(force)), fetchApi(Boolean(force))])
        const subsResult = results[0]
        const apiResult = results[1]
        if (subsResult.status === 'fulfilled') {
          view.subs = subsResult.value
          view.subsError = null
        } else {
          const err = subsResult.reason
          view.subs = null
          view.subsError = (err && err.notFound)
            ? '订阅用量通道不可用（未安装/未启用 dsh-plugin-subscriptions）'
            : `订阅用量获取失败：${(err && err.message) || err}`
        }
        if (apiResult.status === 'fulfilled') {
          view.api = apiResult.value
          view.apiError = null
        } else {
          const err = apiResult.reason
          view.api = null
          view.apiError = (err && err.notFound)
            ? '费用/余额通道不可用（未安装/未启用 dsh-cost-meter）'
            : `DeepSeek 用量获取失败：${(err && err.message) || err}`
        }
        view.lastAt = Date.now()
        view.loading = false
      } finally {
        refreshing = false
        if (refreshBtn) refreshBtn.classList.remove('spin')
      }
      // Collapsed: only refresh the tiny bar status (dot/tooltip); skip rebuilding
      // the hidden content DOM. Expanded: render the full window.
      if (root.classList.contains('collapsed')) updateTabStatus()
      else render()
    }

    function startTimers() {
      if (autoTimer !== null) return
      // Poll only while the window is actually expanded, visible, and on screen;
      // collapsing stops auto-polling (expand refreshes on demand).
      const shouldPoll = () => (
        !document.hidden
        && root !== null
        && root.parentNode !== null
        && !root.classList.contains('collapsed')
      )
      autoTimer = window.setInterval(() => { if (shouldPoll()) void refresh(false) }, AUTO_REFRESH_MS)
      visibilityHandler = () => { if (shouldPoll()) void refresh(false) }
      document.addEventListener('visibilitychange', visibilityHandler)
    }

    function stopTimers() {
      if (autoTimer !== null) { window.clearInterval(autoTimer); autoTimer = null }
      if (visibilityHandler !== null) { document.removeEventListener('visibilitychange', visibilityHandler); visibilityHandler = null }
    }

    function showWindow() {
      if (root && root.parentNode) return
      if (!root) buildStructure()
      document.body.appendChild(root)
      finalizePlacement()
      if (!uiPrefs.collapsed) updateWindowLabel()
      startTimers()
      // Fresh boot or long-hidden data: fetch right away so nothing shows stale.
      if (view.lastAt === 0 || Date.now() - view.lastAt > AUTO_REFRESH_MS) void refresh(false)
    }

    function hideWindow() {
      if (root && root.parentNode) root.parentNode.removeChild(root)
      stopTimers()
    }

    function syncVisibility() {
      if (uiPrefs.visible) showWindow()
      else hideWindow()
    }

    // ── Settings card (React, registered into settings.section slot) ─────────

    function SettingsCard() {
      const [visible, setVisible] = React.useState(() => loadPrefs().visible)
      const [status, setStatus] = React.useState('')

      React.useEffect(() => {
        const onSet = (e) => {
          if (e.detail && typeof e.detail.visible === 'boolean') setVisible(e.detail.visible)
        }
        const onStorage = (e) => {
          if (e.key === LS_UI) setVisible(loadPrefs().visible)
        }
        const onRefreshDone = () => {
          if (view.lastAt > 0) setStatus(`更新于 ${clockText(new Date(view.lastAt))}`)
        }
        window.addEventListener(EVT_SET, onSet)
        window.addEventListener(EVT_REFRESH, onRefreshDone)
        window.addEventListener('storage', onStorage)
        return () => {
          window.removeEventListener(EVT_SET, onSet)
          window.removeEventListener(EVT_REFRESH, onRefreshDone)
          window.removeEventListener('storage', onStorage)
        }
      }, [])

      const toggle = (next) => {
        setVisiblePref(next)
        window.dispatchEvent(new CustomEvent(EVT_SET, { detail: { visible: next } }))
        setVisible(next)
      }

      const doRefresh = () => {
        if (!uiPrefs.visible) toggle(true)
        window.dispatchEvent(new CustomEvent(EVT_REFRESH, { detail: { force: true } }))
        setStatus('刷新中…')
        window.setTimeout(() => {
          if (view.lastAt > 0) setStatus(`更新于 ${clockText(new Date(view.lastAt))}`)
        }, 1200)
      }

      const h = React.createElement
      return h('div', { className: 'ums-card' },
        h('div', { className: 'ums-desc' },
          '右下角用量小窗：订阅模型用量与重置时间、DeepSeek Flash 今日消耗与余额。',
          h('br'),
          h('small', null, '订阅区不显示余额与花费；窗口可拖拽/收起。开关状态记录在此浏览器。'),
        ),
        h('div', { className: 'ums-row' },
          h('div', { className: 'ums-main' },
            h('div', { className: 'ums-name' }, '显示用量小窗'),
            h('div', { className: 'ums-hint' }, visible ? '窗口当前显示在右下角' : '窗口已隐藏，打开后立即刷新'),
          ),
          h('button', {
            className: 'ums-switch',
            type: 'button',
            role: 'switch',
            'aria-checked': visible,
            title: visible ? '隐藏小窗' : '显示小窗',
            onClick: () => toggle(!visible),
          }, h('span', { className: 'knob' })),
        ),
        h('div', { className: 'ums-row' },
          h('div', { className: 'ums-main' },
            h('div', { className: 'ums-name' }, '立即刷新'),
            h('div', { className: 'ums-hint' }, '强制重新查询订阅用量与官方余额'),
          ),
          h('div', { className: 'ums-actions' },
            h('button', { className: 'ums-btn', type: 'button', onClick: doRefresh }, '立即刷新'),
            h('span', { className: 'ums-status' }, status),
          ),
        ),
      )
    }

    // ── plugin apply ─────────────────────────────────────────────────────────

    let settingsDisposers = []

    async function apply(ctx) {
      if (window.__dshUsageMiniApplied) return () => {}
      window.__dshUsageMiniApplied = true

      loadPrefs()
      ensureStyle()

      const onSet = (e) => {
        if (e.detail && typeof e.detail.visible === 'boolean') {
          setVisiblePref(e.detail.visible)
          syncVisibility()
        }
      }
      const onRefresh = (e) => {
        void refresh(Boolean(e && e.detail && e.detail.force))
      }
      const onStorage = (e) => {
        if (e.key === LS_UI) {
          loadPrefs()
          syncVisibility()
        }
      }
      window.addEventListener(EVT_SET, onSet)
      window.addEventListener(EVT_REFRESH, onRefresh)
      window.addEventListener('storage', onStorage)

      // Settings page card (best effort; the float still works without slots).
      try {
        const slots = ctx && typeof ctx.get === 'function' ? ctx.get('slots') : undefined
        if (slots && typeof slots.inject === 'function' && typeof slots.register === 'function') {
          const dispose = slots.inject('settings.section', () => slots.register({
            name: 'settings.section',
            id: 'usage-mini',
            order: 200,
            label: '用量小窗',
            inject: () => ({}),
          }, SettingsCard))
          settingsDisposers.push(dispose)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[dsh-usage-mini] settings card unavailable:', err && err.message ? err.message : err)
      }

      syncVisibility()

      const cleanup = () => {
        window.removeEventListener(EVT_SET, onSet)
        window.removeEventListener(EVT_REFRESH, onRefresh)
        window.removeEventListener('storage', onStorage)
        stopTimers()
        for (const dispose of settingsDisposers) {
          try { dispose() } catch { /* noop */ }
        }
        settingsDisposers = []
        if (root && root.parentNode) root.parentNode.removeChild(root)
        root = null
        window.__dshUsageMiniApplied = false
      }
      if (ctx && typeof ctx.effect === 'function') {
        ctx.effect(() => cleanup, `${UID}: lifecycle`)
      }
      return cleanup
    }

    exports.apply = apply
    return module.exports
  },
})
