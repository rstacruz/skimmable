<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="skimmable — a wall of text becomes scannable bullet points">
</p>

# skimmable

Claude Code and [Pi](https://pi.dev/) plugin that formats every reply in a more readable way.

## Example

<table>
<tr>
<th>Before:</th>
<th>After:</th>
<tr>
<td>

> Your npm install is failing because there's a peer dependency conflict: the
> project requires `eslint ^9` but you have `eslint 8.57.0` installed globally,
> and `eslint-plugin-import` v2.31.0 lists `eslint >=9` as a peer dependency.
> The fix is to either update your global eslint with `npm install -g eslint@9`,
> or add an override in your `package.json` under the `overrides` key pointing
> `eslint` to `^9.0.0`. If you go the override route, make sure to run
> `npm install` again and verify the resolved version with `npm ls eslint`.

</td>
<td>

> - **Cause** — peer dependency conflict
>   - Project requires `eslint ^9`
>   - Global install has `eslint 8.57.0`
>   - `eslint-plugin-import` v2.31.0 needs `eslint >=9`
> - **Fix 1** — update the global install
> 
>   ```bash
>   npm install -g eslint@9
>   ```
> 
> - **Fix 2** — override in `package.json`
> 
>   ```json
>   { "overrides": { "eslint": "^9.0.0" } }
>   ```
> 
> Then run `npm install` and verify with `npm ls eslint` — it should resolve to `9.x`.


</td>
</tr>
</table>

More examples are available in [examples/](./examples/sonnet/).

## Install

### Claude Code

```bash
claude plugin marketplace add https://github.com/rstacruz/skimmable && claude plugin install skimmable@skimmable
```

Update to a new version with `/plugin marketplace update`.

### Pi

```bash
pi install git:github.com/rstacruz/skimmable
```

### All other agents

For other agents, it doesn't auto-enable, but you may invoke it manually via `/skimmable`.

```bash
npx skills add rstacruz/skimmable
```

## Usage

Nothing to do — skimmable is on from the first prompt of every fresh session.

- **Turn it off** — say `stop skimmable` (or `normal mode`). Lasts the rest of the session.
- **Turn it back on** — say `skimmable`. Works mid-session, no restart.
- **New session** — on again by default.

## For Markdown files

Installing the plugin also installs the [skimmable](./skills/skimmable/SKILL.md) skill. It works great on formatting plans:

> Make plan.md /skimmable

> Summarise the top hackernews article in /skimmable format

## How it works

- **SessionStart hook** injects the ruleset (from `skills/skimmable/SKILL.md`) as hidden system context before the first prompt.
- **UserPromptSubmit hook** re-reinforces the style every turn; every 3rd ON turn it re-embeds the full ruleset (drift refresh). It also implements the natural-language toggle.
- **Compaction refresh** — after context compaction the full ruleset is re-injected at the next prompt: Claude re-fires SessionStart with `source='compact'`, Pi fires `session_compact` and refreshes on the next turn. Between compactions the per-turn reminder carries the style.
- **State** is one flag file at `$CLAUDE_CONFIG_DIR/.skimmable-active` — exists = on, absent = off — plus a state file at `$CLAUDE_CONFIG_DIR/.skimmable-state` holding per-session turn counts for the 3-turn cadence.

## Token cost

<details>
<summary>Claude Sonnet 5 (Aug 2026): 7% fewer tokens (Aug 2026)</summary>

<!-- BENCHMARK-TABLE-START -->


| Task | Normal (tokens) | Skimmable (tokens) | Saved |
|------|---------------:|-------------------:|------:|
| Explain React re-render bug | 592 | 473 | 20% |
| Fix auth middleware token expiry | 497 | 703 | -41% |
| Set up PostgreSQL connection pool | 717 | 635 | 12% |
| Explain git rebase vs merge | 714 | 656 | 8% |
| Refactor callback to async/await | 255 | 268 | -5% |
| Architecture: microservices vs monolith | 1044 | 1023 | 2% |
| Review PR for security issues | 398 | 481 | -21% |
| Docker multi-stage build | 391 | 360 | 8% |
| Debug PostgreSQL race condition | 491 | 210 | 57% |
| Implement React error boundary | 887 | 629 | 29% |
| **Average** | **599** | **544** | **7%** |

*Range: -41%–57% savings across prompts.*

<!-- BENCHMARK-TABLE-END -->

</details>

<details>
<summary>Deepseek v4 Flash: 45% more tokens (Aug 2026)</summary>


| Task | Normal (tokens) | Skimmable (tokens) | Saved |
|------|---------------:|-------------------:|------:|
| Explain React re-render bug | 1740 | 1023 | 41% |
| Fix auth middleware token expiry | 3806 | 5168 | -36% |
| Set up PostgreSQL connection pool | 2514 | 12635 | -403% |
| Explain git rebase vs merge | 896 | 855 | 5% |
| Refactor callback to async/await | 583 | 1343 | -130% |
| Architecture: microservices vs monolith | 2585 | 760 | 71% |
| Review PR for security issues | 2105 | 849 | 60% |
| Docker multi-stage build | 7927 | 2130 | 73% |
| Debug PostgreSQL race condition | 1404 | 2429 | -73% |
| Implement React error boundary | 4204 | 6798 | -62% |
| **Average** | **2776** | **3399** | **-45%** |

*Range: -403%–73% savings across prompts.*

</details>

## Special thanks

This plugin is based off of [caveman](https://github.com/JuliusBrussee/caveman) by [JuliusBrussee](https://github.com/JuliusBrussee).

## Prior art

Also check out:

- [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) — focused on reducing tokens
- [ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd) —  action-first
- [nextor2k/hyperfocus](https://github.com/nextor2k/hyperfocus) — multiple modes
- [Vistyy/nopus](https://github.com/Vistyy/nopus) — deterministic prose checks; requests a clearer rewrite
- [gvzdv/claudish-to-english](https://github.com/gvzdv/claudish-to-english) — plain-English rewrites via local LLM; display-only
