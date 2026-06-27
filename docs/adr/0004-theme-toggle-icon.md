# ADR-0004: Theme Toggle Icon — Keep Emoji, Close as Wontfix

The theme toggle button uses emoji (☀️/🌙) for the dark/light mode toggle icon. Despite minor UX concerns, it is kept as-is.

## Context

Issue #251 reported three concerns about the theme toggle button:
1. Emoji rendering varies across platforms (Windows vs macOS vs mobile)
2. Counter-intuitive meaning — sun icon in dark mode (meaning "switch to light") looks like "dark mode is on"
3. No tooltip explaining the action

The toggle button is at `public/js/app.js` line ~`toggleTheme()`:
```js
btn.textContent = next === 'dark' ? '☀️' : '🌙';
```

## Decision

- **Keep emoji** (☀️/🌙) as the toggle icon
- **Close #251** as wontfix
- **No SVG replacement**, no tooltip addition

## Rationale

- **International convention**: Sun = light mode, Moon = dark mode is universally recognized. Users quickly learn the pattern.
- **Low priority**: The toggle works correctly; the concerns are minor UX polish, not functional problems.
- **Emoji rendering**: Minor cross-platform variation exists but is acceptable for an internal tool.
- **Counter-intuitive concern**: The "sun in dark mode" meaning "switch to light" is actually correct — it shows the *next state*, not the *current state*. This is standard UI convention (e.g., YouTube's dark mode toggle, VS Code's theme switch).
- **Cost vs benefit**: Replacing emoji with SVG + adding tooltips adds code complexity for a negligible improvement in an internal tool.

## Consequences

- Emoji rendering will still vary slightly across platforms (cosmetic only).
- No tooltip — users must learn the icon meaning, which happens naturally after first use.
- If a future audit or user feedback elevates this priority, SVG replacement is straightforward.
