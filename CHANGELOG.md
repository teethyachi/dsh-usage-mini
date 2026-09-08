# Changelog

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
