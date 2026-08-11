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
- **UserPromptSubmit hook** re-reinforces the style every turn, so it survives context compaction; it also implements the natural-language toggle.
- **State** is one flag file at `$CLAUDE_CONFIG_DIR/.skimmable-active` — exists = on, absent = off.

## Special thanks

This plugin is based off of [caveman](https://github.com/JuliusBrussee/caveman/tree/main) by [JuliusBrussee](https://github.com/JuliusBrussee).
