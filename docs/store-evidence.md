# Disposable-Profile evidence for DSH STORE (dsh-usage-mini 0.2.1)

Recorded 2026-09-08 on Windows 11, Node v22.23.2, pnpm 11.24.0, official npm `@deepseek-ai/dsh@0.1.2-rc.1`. All commands ran with `DSH_HOME` pointed at a throwaway directory (`<scratch>`); the author's real `~/.dsh`, credentials and running web server (port 3080) were not touched and were verified still serving afterwards. No provider, account or inference calls were made. Placeholders: `<dsh-bin>` = `<scratch>/cli/node_modules/@deepseek-ai/dsh/lib/bin.js`.

Plugin artifact: `npm pack` of this repository at version 0.2.0 (the 0.2.1 delta is a 405-handling fix found by this very run; see step 4).

## Gates

| Gate | Result | How |
|---|---|---|
| install | **pass** | `DSH_HOME=<scratch>/home node <dsh-bin> plugin --profile web add <scratch>/dsh-usage-mini-0.2.0.tgz` → exit 0; `profiles/web/node_modules/dsh-usage-mini/package.json` version 0.2.0 |
| config composition | **pass** | `--dump-config` contains the `dsh-usage-mini` layer (3 matches) |
| **start (full `dsh --profile web`)** | **pass** | `DSH_HOME=<scratch>/home node <dsh-bin> --profile web --no-open --host 127.0.0.1 --port 3628` → `dsh web: http://127.0.0.1:3628/?token=…`; `GET /` with token → 303 → 200 with `window.__DSH_BOOT__` injected; the boot payload's module list registers `{"id":"dsh-usage-mini","url":"/plugins/??dsh-usage-mini/client.js&rev=…"}`; fetching that URL → 200, `text/javascript`, 69 866 B, `PLUGIN_VERSION = '0.2.0'` |
| **browser acceptance** | **pass** | Headless Chromium (Playwright 1.61.1) in two contexts, `locale: zh-CN` and `locale: en-US`. Widget root rendered; head title 用量小窗 / Usage Window; feedback bar 给点儿意见？·发送 / Any feedback?·Send; both sections show the honest "channel unavailable (plugin not installed / enabled)" state because the scratch profile has neither `dsh-plugin-subscriptions` nor `dsh-cost-meter`. Zero `pageerror`, zero plugin console errors. Screenshots: `evidence/shot-zh-CN.png`, `evidence/shot-en-US.png` in the campaign folder (DSH's own "Internal Testing Notice" modal is visible; the widget sits below it, bottom-right). Script: `useage-window-campaign/scripts/store628-acceptance.cjs` |
| uninstall | **pass** | `plugin --profile web remove dsh-usage-mini` → exit 0; `node_modules/dsh-usage-mini` gone; `--dump-config` 0 matches |
| rollback | not exercised | — |

## Finding fixed in 0.2.1

On the bare web profile, `POST /subscriptions-auth/status` answered **405** rather than 404, so 0.2.0 showed "fetch failed: HTTP 405" instead of the intended "channel unavailable" state. 0.2.1 treats 405 like 404 (both mean no handler is installed). Re-ran the browser acceptance against the patched file on the still-running scratch server: both sections show the "not installed / enabled" message in both locales, still zero errors.

## Declaration

`dsh.compatibility.dshReleases["0.1.2-rc.1"]` is now `compatible` on the strength of the full start + browser gate above. `0.1.1-rc.2`, `0.1.2-alpha.4`, `0.1.2-alpha.5` stay `unknown`: only install / composition (rc.2) or nothing (alphas) has been run on them.

## Reproduce

```sh
S=$(mktemp -d); mkdir -p $S/home $S/cli && cd $S/cli && npm init -y && npm i @deepseek-ai/dsh@0.1.2-rc.1
BIN=$S/cli/node_modules/@deepseek-ai/dsh/lib/bin.js
DSH_HOME=$S/home node $BIN plugin --profile web add /path/to/dsh-usage-mini-0.2.1.tgz
DSH_HOME=$S/home node $BIN --profile web --no-open --host 127.0.0.1 --port 3628 &
# open the printed URL, or run useage-window-campaign/scripts/store628-acceptance.cjs $S
DSH_HOME=$S/home node $BIN plugin --profile web remove dsh-usage-mini
```
