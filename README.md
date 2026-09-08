# 用量小窗（USEAGE WINDOW）

**Your agents have big plans. Your quota has office hours.**

A tiny floating usage dashboard for **DeepSeek Harness Web**. Check the meter without turning your workflow into a browser-tab scavenger hunt. Think campus budget committee, minus the three-hour meeting.

> **Currently supports Claude subscriptions, Codex (ChatGPT) subscriptions, and DeepSeek API only.** Not a universal billing dashboard. Not an official Anthropic, OpenAI, or DeepSeek product.

## What you get

- **Claude + Codex subscriptions:** available usage windows, used/remaining percentages, reset times and countdowns. No made-up dollar balance for a subscription.
- **DeepSeek API:** today’s locally recorded official-provider spend and calls, plus the upstream cached official account balance. Includes a Flash breakdown when present.
- Drag it where you want. Collapse it into the nearest corner. It remembers its spot in this browser.
- Settings toggle, manual refresh, and 60-second polling while expanded and the page is visible. Collapsed or hidden? No polling busywork. Your usage monitor should not need its own usage monitor.

## Install

Requires a compatible DeepSeek Harness Web installation and pnpm. This repository ships ready-to-load JavaScript; no build step or install script.

```sh
dsh plugin --profile web add github:teethyachi/dsh-usage-mini#v0.1.1
```

Or download the release tarball and run:

```sh
dsh plugin --profile web add ./dsh-usage-mini-0.1.1.tgz
```

Restart your existing Web profile, then refresh its page. Open Settings → 用量小窗 to show/hide the widget. The interface currently uses Chinese labels; this release’s documentation is English. Package ID stays `dsh-usage-mini` for compatibility; **USEAGE WINDOW** is the requested product spelling.

### Required data providers

This is a display plugin, not a replacement account connector. Enable these separately in the same Web profile:

| Feature | Required existing plugin |
|---|---|
| Claude / Codex usage | `dsh-plugin-subscriptions`, with the relevant subscription signed in |
| DeepSeek spend / balance | `dsh-cost-meter`, with ledger and official balance configured |

They are **not bundled or silently installed**. If an endpoint is unavailable, that section shows a notice; the other section can still work. Compatibility depends on these RPC contracts, not merely having a similarly named package installed.

## Compatibility (declared in `package.json`)

| Field | Value | Evidence |
|---|---|---|
| Node.js (`engines.node`) | `>=22.19.0` | Exercised on Node 22.23.2 (Windows). Host DSH itself requires `^22.19.0 \|\| >=24.0.0`; the plugin has no Node-side logic beyond a no-op `apply()`. |
| DSH (`dsh.compatibility.dshReleases`) | `0.1.1-rc.2`: compatible, `0.1.2-rc.1`: compatible | Disposable `DSH_HOME` profile: `dsh plugin --profile web add <tarball>`, `--dump-config` shows the `usage-mini` layer, `dsh plugin --profile web remove dsh-usage-mini` cleans up. See [docs/store-evidence.md](docs/store-evidence.md). |
| Other DSH versions | unknown | Not tested; not claimed. |
| Profile | `web` only | Browser client; no headless/TUI behaviour. |
| OS | Windows (`win32`) tested | Nothing OS-specific in the code, but only Windows was exercised. |

The manifest declarations are source compatibility statements. They are not a claim that DSH STORE has completed its own Profile install or runtime acceptance.

## Permissions, dependencies and failure boundaries

- **Lifecycle scripts:** none (`preinstall`/`install`/`postinstall`/`prepare` absent). **Runtime dependencies:** none; only `react` is required from the DSH web module loader.
- **Network:** the browser client issues same-origin `fetch` POSTs to the current DSH origin only: `/subscriptions-auth/status`, `/subscriptions-auth/usage`, `/api/costMeter/getState`, `/api/costMeter/refreshBalance`. It never calls an external host itself. Upstream plugins (`dsh-plugin-subscriptions`, `dsh-cost-meter`) do contact Anthropic/OpenAI/DeepSeek on your behalf when serving those RPCs; a forced refresh triggers such upstream calls.
- **Files / commands / credentials:** none. The host half is a no-op; the plugin reads no files, spawns no processes and never handles tokens. Credential state stays inside the upstream plugins.
- **Local storage:** one browser `localStorage` key, `dsh-usage-mini:ui` (window position, collapsed state, visibility). No usage data is persisted by this plugin.
- **On-screen data:** account labels returned by the subscriptions plugin and cached balances can be visible in the widget. Redact screenshots.
- **Stale-cache semantics:** the DeepSeek balance is the cost-meter cached snapshot. Automatic polling only requests a refresh when no balance was ever fetched; the manual button forces a refresh. If the refresh fails, the previous snapshot stays with its own status message.
- **Failure boundaries:** an RPC returning HTTP 404 is shown as “channel missing” for that section only; the other section keeps working. Any other error is displayed as text in that section. The plugin cannot crash the host: its host entry does nothing, and client errors are caught per section.

## Read the numbers like an adult (tragic, we know)

- Subscription percentages are upstream usage windows, not money and not a per-chat bill.
- Today’s DeepSeek spend comes from the cost-meter ledger (`deepseek` / `deepseek-official` routes). It is **not guaranteed to include every charge on your provider account**. Currency conversion uses cost-meter settings.
- Balance is a cached snapshot. Manual refresh requests an update; network/provider failures can leave an older snapshot.
- This widget does **not** enforce budgets, stop agents, switch models, or promise savings.

## Privacy & implementation

A no-op host entry plus a browser client using DSH’s module loader and `settings.section` slot. Requests go to the current DSH origin: `/subscriptions-auth/status`, `/subscriptions-auth/usage`, `/api/costMeter/getState`, and `/api/costMeter/refreshBalance`. Existing host plugins handle upstream authentication. This package adds no external analytics or credential-entry UI.

Browser localStorage keeps display preferences. Account labels and balances can appear on screen: redact screenshots before sharing. Never publish your DSH profile, credentials, ledger, or session history.

## Remove

```sh
dsh plugin --profile web remove dsh-usage-mini
```

Restart the Web profile.

## Links

- Hugging Face Space (project page / mirror): https://huggingface.co/spaces/BruceWuu/useage-window
- 中文介绍（为什么做这个小窗）: [docs/blog-zh.md](docs/blog-zh.md)

If this widget saves you a tab, a GitHub Star or a Like on the Hugging Face Space helps other DSH users find it. Bug reports and PRs are more useful still.

## Release verification

Run `npm test` and `npm pack --dry-run`. Automated checks cover package wiring and the balance-refresh regression; they are not a claim of fresh live-account testing on every provider or browser. The installed personal copy is not modified by this publication.

MIT licensed. Contributions welcome—especially accurate failure states, not confident-looking zeroes.
