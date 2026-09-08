# Changelog

## 0.1.2

- Declare explicit compatibility in the manifest: `engines.node >=22.19.0`, `dsh.compatibility.dsh`, per-version `dshReleases` (`0.1.1-rc.2`, `0.1.2-rc.1` tested as compatible; other versions unknown), `profiles: ["web"]`, `os: ["win32"]`.
- Document permissions, network endpoints, dependencies, local storage and failure boundaries for DSH STORE review (README + `docs/store-evidence.md`).
- Add regression tests for the compatibility manifest shape, the same-origin RPC endpoint list and the absence of lifecycle scripts.
- No runtime behaviour change; `lib/` and `cordis.patch.yml` are identical to 0.1.1.

## 0.1.1

- First packaged public release as **用量小窗（USEAGE WINDOW）**.
- Keep the existing `dsh-usage-mini` DSH package, bundle, module and storage identifiers.
- Fix manual refresh not requesting a new DeepSeek balance when the previous cached balance was healthy.
- Add package wiring and balance-refresh regression checks.
- English release documentation; widget labels remain Chinese.

## 0.1.0

- Original local floating dashboard: subscription windows, DeepSeek API ledger/balance, settings toggle, draggable corner docking and visibility-aware polling.
