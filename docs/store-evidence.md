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

# 2. Compose the profile configuration through the patch algorithm (NOT a runtime start)
DSH_HOME=<scratch>/home node <dsh-bin> --profile web --dump-config
# exit 0. Output contains the layer "# == dsh-usage-mini" with "- id: usage-mini / name: dsh-usage-mini"
# --dump-config only composes configuration layers; it does not load or start any plugin.

# 3. Uninstall through the real DSH plugin command
DSH_HOME=<scratch>/home node <dsh-bin> plugin --profile web remove dsh-usage-mini
# exit 0. dependency and bundle entry removed, node_modules entry gone,
# --dump-config afterwards contains 0 matches for usage-mini
```

## Isolated host-entry boot (DSH `0.1.2-rc.1` only, non-listening)

Added as a correction: the earlier wording "load" above was overbroad, because `--dump-config` composes configuration and never starts a plugin. To get a genuine but narrow runtime data point, the plugin row alone was booted through the installed runtime's own `boot()` from `@deepseek-ai/dsh-app-boot` (the function `dsh --profile web` itself calls), with a synthetic patch stack containing only this plugin's bundle row. No base bundle, no web-app bundle, no web server, no provider, credential or inference access.

```sh
# after step 1 (plugin installed into the disposable profile)
DSH_HOME=<scratch>/home node <scratch>/boot-plugin-only.mjs
# script: prepareProfile('web') from the installed dsh CLI; patches = the plugin layer only,
#   i.e. [{"insert":[{"id":"usage-mini","name":"dsh-usage-mini"}]}]; ctx = await boot('dsh', <profile>/cordis.yml, patches)
# exit 0. "boot ok in 508 ms"; loader entries: cordis:include (fiber state 2 = active),
#   usage-mini / dsh-usage-mini (fiber state 2 = active); ctx.fiber.dispose() completed.
```

This shows the host half (`lib/index.js`, no-op `apply()`) is resolvable and activatable by the real `0.1.2-rc.1` loader in isolation. It does **not** show a full `dsh --profile web` start, delivery of `lib/client.js` through the web module loader, or browser rendering. Not run on `0.1.1-rc.2`.

## What this does and does not prove

| Gate | Status | Notes |
|---|---|---|
| install | verified (disposable Profile) | Real `dsh plugin add`, not a manual copy |
| config composition | verified (disposable Profile) | `--dump-config`; composition only, not a runtime load or start |
| host-entry boot (isolated, non-listening) | partial, `0.1.2-rc.1` only | Plugin row booted alone through the runtime's `boot()`; see above |
| start (full `dsh --profile web`, web server, browser UI) | **unknown / not verified** | Not run in this evidence set; the widget has been used interactively by the author on a local web profile, which is not reproducible evidence |
| uninstall | verified (disposable Profile) | Real `dsh plugin remove` |
| rollback | unknown | Not exercised |
| `dshReleases` declaration | all `unknown` | `0.1.1-rc.2`, `0.1.2-alpha.4`, `0.1.2-alpha.5`, `0.1.2-rc.1` are declared `unknown` because none has full-start evidence; "compatible" is not self-certified from install/composition alone |

Environment note: on Windows the DSH pnpm forwarder does not quote arguments, so a tarball path containing a space fails inside pnpm. A path without spaces (or an 8.3 short path) works. This is not a property of the plugin.

Regression tests (`npm test`): manifest shape (exact tested Node `22.23.2`, no `compatible` DSH release without documented start evidence), same-origin endpoint list, no lifecycle scripts, balance-refresh behaviour.
