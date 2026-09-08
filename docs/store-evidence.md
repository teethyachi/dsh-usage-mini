# Disposable-Profile evidence for DSH STORE (dsh-usage-mini 0.1.2)

Recorded 2026-09-07 on Windows 11, Node v22.23.2, npm 12.0.2, pnpm 11.24.0. All commands ran with `DSH_HOME` pointed at a throwaway directory; the real `~/.dsh` profile, credentials and running web server were not touched. No provider or account calls were made. Placeholders: `<scratch>` = throwaway directory, `<dsh-bin>` = the `lib/bin.js` of the DSH version under test.

## DSH versions under test

| DSH version | Source |
|---|---|
| `0.1.1-rc.2` | Built CLI from the `deepseek-harness` checkout at tag `dsh-v0.1.1-rc.2` |
| `0.1.2-rc.1` | Official npm `@deepseek-ai/dsh@0.1.2-rc.1` (npm `latest` on 2026-09-07) installed into `<scratch>/dsh-rc1` |

Plugin artifact: `npm pack` of this repository at version 0.1.2 (6 files, no lifecycle scripts).

## Commands and results (identical outcome for both versions)

```sh
# 1. Install through the real DSH plugin command (pnpm forwarder + bundle reconciliation)
DSH_HOME=<scratch>/home node <dsh-bin> plugin --profile web add <scratch>/dsh-usage-mini-0.1.2.tgz
# exit 0. profiles/web/package.json: dependencies.dsh-usage-mini added,
# dsh.profile.bundles = ["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app","dsh-usage-mini"]
# profiles/web/node_modules/dsh-usage-mini/package.json version = 0.1.2

# 2. Load the composed profile through the actual loader (no server boot)
DSH_HOME=<scratch>/home node <dsh-bin> --profile web --dump-config
# exit 0. Output contains the layer "# == dsh-usage-mini" with "- id: usage-mini / name: dsh-usage-mini"

# 3. Uninstall through the real DSH plugin command
DSH_HOME=<scratch>/home node <dsh-bin> plugin --profile web remove dsh-usage-mini
# exit 0. dependency and bundle entry removed, node_modules entry gone,
# --dump-config afterwards contains 0 matches for usage-mini
```

## What this does and does not prove

| Gate | Status | Notes |
|---|---|---|
| install | verified (disposable Profile) | Real `dsh plugin add`, not a manual copy |
| load / config composition | verified (disposable Profile) | `--dump-config` runs the profile loader without booting |
| start (web server boot, browser UI) | not verified here | Not run in this evidence set; the widget has been used interactively by the author on a local web profile, which is not reproducible evidence |
| uninstall | verified (disposable Profile) | Real `dsh plugin remove` |
| rollback | unknown | Not exercised |
| DSH `0.1.2-alpha.4`, `0.1.2-alpha.5`, others | unknown | Not tested, therefore not declared |

Environment note: on Windows the DSH pnpm forwarder does not quote arguments, so a tarball path containing a space fails inside pnpm. A path without spaces (or an 8.3 short path) works. This is not a property of the plugin.

Regression tests (`npm test`): manifest shape, same-origin endpoint list, no lifecycle scripts, balance-refresh behaviour.
