# ADR-0003: SEO Meta Tags Scope for Internal Knowledge Base

The app's `<head>` metadata is scoped to Open Graph tags only (no Twitter Cards, no canonical URLs, no keywords). Meta descriptions are dynamic per page via JavaScript.

## Context

PR #264 added OG tags, favicon, and dynamic meta descriptions to address issues #255, #256, #259. The site is an internal IT Operations Knowledge Base accessed primarily within the local network.

## Decision

- **OG tags only**: `og:title`, `og:description`, `og:url`, `og:type`, `og:image` — all static generic values.
- **No Twitter Card tags**: `twitter:card`, `twitter:title`, `twitter:description` omitted.
- **No `<link rel="canonical">`**: Canonical URL omitted.
- **No `<meta name="keywords">`**: Keywords meta tag omitted.
- **og:url hardcoded to `.local`**: `https://it-ops-kb.local` — acceptable for internal use.
- **og:image as relative path**: `/og-image.png` — social scrapers may prefer absolute URLs, but internal link previews work fine with relative paths.
- **Dynamic meta descriptions**: `setPageTitle(page)` updates both `document.title` and `<meta name="description">` per route.

## Rationale

- **Internal audience**: The primary consumers are internal team members via Slack/Teams/Telegram links. OG tags provide acceptable preview cards in these platforms.
- **Twitter is not a sharing target**: No need for Twitter Card optimization — the site is not shared on Twitter/X.
- **Keywords are dead**: Search engines ignore `<meta name="keywords">`. For an internal site with no external SEO need, it's noise.
- **Canonical URL not needed**: No risk of duplicate content — the SPA is a single entry point.
- **`.local` domain is fine**: The site is not publicly accessible. External crawlers won't encounter it. If the domain changes, `og:url` can be updated in a future PR.
- **Static OG values are sufficient**: Per-page OG tags add complexity for negligible internal benefit. A generic "IT Operations Knowledge Base" image and description work for all shared links.

## Consequences

- If the site ever goes public or is shared on Twitter, OG previews will be generic and Twitter previews will fall back to the meta description.
- Adding Twitter Cards or canonical URLs later is straightforward — no architectural blockers.
- The dynamic meta description via JS means the initial HTML `<meta name="description">` is a fallback (set by the server or static HTML).
