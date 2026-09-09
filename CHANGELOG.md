# Changelog

## 0.2.2

- All four corners work. Before: dragging the expanded window toward the right or bottom edge let it run off-screen (only the top/left were clamped), so top-right / bottom-left / bottom-right "custom" spots came back partly hidden after collapse → expand. Now: drag and restore are clamped to the viewport on both axes; a collapsed bar dragged to a new corner expands at that corner instead of flying back to the old spot; a viewport resize re-runs placement. Reproducible with `useage-window-campaign/scripts/corners.cjs` (headless Chromium, drag/collapse/expand at each corner); test 8 locks the geometry. The 掘金 write-up admitted "另外三个角布局是坏的" — this is that fix.

## 0.2.1

- Treat HTTP 405 from an RPC path like 404: both mean the upstream plugin isn't installed, so the section shows "channel unavailable" instead of "fetch failed: HTTP 405". Found by the full-start acceptance run below.
- DSH `0.1.2-rc.1` declared **compatible**: full `dsh --profile web` start from a disposable `DSH_HOME`, client delivered through the real web module loader, headless-browser render in zh-CN and en-US with zero page errors, then clean uninstall. Evidence and reproduce steps in `docs/store-evidence.md`.

## 0.2.0

- **UI follows the DSH language setting.** The widget and its Settings card read the host's `<html lang>` (`zh-CN` / `en`, as set by Settings → Language) and switch live when it changes; fallback is `navigator.language`, then English. No own language switch, no new storage key. All ~70 strings are externalized in `STR.zh` / `STR.en`; the feedback prompt is 给点儿意见？ / Any feedback?.
- **English-first repository.** README.md is English; `README.zh-CN.md` added. Issue template is English (feedback body may be any language). Promo copy lives in `docs/promo-en.md` and `docs/promo-zh.md` as two independent systems.
- Test: zh/en dictionaries share one key set, the English dictionary contains no CJK, and locale detection follows `<html lang>` → `navigator.language` → `en`.
- No change to data paths: the same four same-origin RPCs, no new network endpoints.

## 0.1.4

- Feedback bar prompt is now a single line, **给点儿意见？**, replacing the rotating prompts. Drops the prompt-rotation index from `dsh-usage-mini:feedback` local storage. No other change.

## 0.1.3

- **New: feedback bar** at the bottom of the expanded window. Type one line, press 发送, and a pre-filled GitHub issue (`feedback.yml` template, label `feedback`) opens in a new tab. The plugin itself sends nothing: the only data placed in the URL is your text and the plugin version — never usage numbers, balances, account identifiers or tokens. Rotating prompts (replaced by 给点儿意见？ in 0.1.4), 500-character cap, 60-second local cooldown.
- Add `.github/ISSUE_TEMPLATE/feedback.yml`. Every feedback issue gets a reply; adopted ones are credited in the CHANGELOG of the release that ships them.
- README: new "Feedback" section describing exactly what the feedback bar does and does not transmit.
- Add tests for the feedback URL builder (encoding, length cap, no sensitive fields) and the unchanged same-origin RPC endpoint list.
- Includes the 0.1.2 manifest corrections below (previously untagged).

## 0.1.2 (unreleased, folded into 0.1.3)

- **Correction:** the first 0.1.2 draft declared `engines.node >=22.19.0` and marked DSH `0.1.1-rc.2` / `0.1.2-rc.1` as `compatible`. That overstated the evidence: only Node 22.23.2 was exercised, and the DSH checks were install, `--dump-config` configuration composition and uninstall, not a plugin runtime start. The manifest now declares `engines.node` as the exact tested `22.23.2`, omits `dsh.compatibility.dsh`, and lists `0.1.1-rc.2`, `0.1.2-alpha.4`, `0.1.2-alpha.5`, `0.1.2-rc.1` as `unknown` until reproducible full-profile runtime evidence exists.
- Declare `dsh.compatibility.profiles: ["web"]` and `os: ["win32"]` (the only OS exercised).
- README: install section distinguishes the tagged 0.1.1 release from the untagged corrected manifest; the "cannot crash the host" wording is qualified as a design statement.
- Document permissions, network endpoints, dependencies, local storage and failure boundaries for DSH STORE review (README + `docs/store-evidence.md`).
- Add regression tests for the compatibility manifest shape (exact tested Node, no `compatible` DSH release without documented start evidence), the same-origin RPC endpoint list and the absence of lifecycle scripts.
- No runtime behaviour change; `lib/` and `cordis.patch.yml` are identical to 0.1.1.

## 0.1.1

- First packaged public release as **用量小窗（USEAGE WINDOW）**.
- Keep the existing `dsh-usage-mini` DSH package, bundle, module and storage identifiers.
- Fix manual refresh not requesting a new DeepSeek balance when the previous cached balance was healthy.
- Add package wiring and balance-refresh regression checks.
- English release documentation; widget labels remain Chinese.

## 0.1.0

- Original local floating dashboard: subscription windows, DeepSeek API ledger/balance, settings toggle, draggable corner docking and visibility-aware polling.
