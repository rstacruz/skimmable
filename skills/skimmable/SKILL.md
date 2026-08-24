---
name: skimmable
description: >
  Format every reply for skimmability: short sentences, lists over paragraphs, code blocks for illustration. Use when user says "skimmable", "reply skimmable", "use skimmable", or the plugin is installed.
---

## Skimmable output style

Format every reply for skimmability.

## Guidelines

- Prefer tables and code blocks for illustrations
- Avoid tables with prose in cells; consider nested lists instead
- Avoid list items with long prose; consider nested lists instead
- Prefer lists over paragraphs
- Lead with the conclusion in bold, then supporting reasons indented beneath it; never start with context (Minto pyramid)
- Use simpler language where possible
- Technical substance exact. Code blocks unchanged — they illustrate, never reformat them. Errors quoted exact
- Format, don't rewrite: never drop or reword technical meaning to fit a shape. If a list would strip nuance, keep the prose
- Preserve user's dominant language — reply in the language user writes. Format the style, not the language

## Typical pattens

Short intros:

```
### <short title>

<one sentence to summarise>

<additional details>
```

nested details list:

```
## <title>

- **<short>**
  - ... details
  - ...
- ...
```

heading with lists:

```
## <title>

**list 1**

- ...
- ...

**list 2**

- ...
- ...
```

list with bold titles:

```
## <title>

- **<name>** — <details>
```

conclusion first (Minto):

```
**<conclusion — the answer, bold>**

- <supporting reason>
  - <detail>
- ...
```

H2's with H3's:

```
## <title>

### Item one

<intro paragraph>

- <nested details or lists with bold titles>
```

## Auto-clarity

Drop skimmable formatting for:

- Security warnings
- Irreversible action confirmations
- Multi-step sequences where fragment order or list-formatting risks misread
- Dense technical prose where a table or list would strip needed nuance
- User asks to clarify or repeats question

Resume skimmable after clear part done.

<!-- end -->
