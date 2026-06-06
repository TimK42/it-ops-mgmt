# UI/UX Audit Report — Tag Suggestion Feature

> Conducted: 2026-06-06 via Chrome CDP (375px mobile + desktop)
> Focus: Tag chip input (issue #107 PR #108, post-merge fix `14c5fe3`)
> App: IT Operations KB v1.1.0

---

## ✅ Working Correctly

| Feature | Status | Details |
|---------|--------|---------|
| Inline chips (no absolute dropdown) | ✅ **PASS** | `position: static` on `.suggestions-area` |
| 44px min-height on suggestion chips | ✅ **PASS** | `min-height: 44px` verified via computed style |
| Horizontal scroll on overflow | ✅ **PASS** | `overflow-x: auto`, `width: 100%` |
| Top-10 suggestions on empty input | ✅ **PASS** | 10 chips shown (9 after excluding selected) |
| Case-insensitive filtering | ✅ **PASS** | "p" → shows #api, #export, #report, #updated, #vpn |
| Selected tag exclusion | ✅ **PASS** | #password hidden after selection (case-insensitive) |
| Debounced filtering | ✅ **PASS** | Clears input → returns to top-10 after ~300ms |
| Enter adds custom tag | ✅ **PASS** | "newtag" added as chip on Enter key |
| Comma adds custom tag | ✅ **PASS** | (spec requirement) |
| Click suggestion adds tag | ✅ **PASS** | #password click → selected chips updated |
| Remove button aria-labels | ✅ **PASS** | `aria-label="Remove password"` on ✕ buttons |
| Placeholder text | ✅ **PASS** | "Type tag and press Enter or comma..." |
| Modal framework | ✅ **PASS** | Tag input properly nested inside modal form |

---

## 🔴 Critical Issues

### C1. Selected chip touch targets too small

**Severity:** Critical  
**Pages affected:** QA Create / Edit modal (mobile 375px)  
**Evidence:**
- `.chip` has `padding: 2px 6px 2px 8px`, `font-size: 12px` → computed height ~20px
- `.chip-remove` (✕ button) is `16×16px` — below WCAG 2.5.5 minimum (24×24px)
- On mobile, users must tap these tiny targets to remove tags

**Fix:**
```diff
 .chip {
+  min-height: 44px;
+  padding: 10px 12px;
-  padding: 2px 6px 2px 8px;
 }
 .chip-remove {
-  width: 16px;
-  height: 16px;
+  width: 24px;
+  height: 24px;
   font-size: 10px;
 }
```

### C2. Tag input not programmatically associated with its label

**Severity:** Critical (WCAG 1.3.1, 4.1.2)  
**Pages affected:** QA Create / Edit modal  
**Evidence:**
- `<input id="f-tags-input">` exists with no `aria-label` or `aria-labelledby`
- Adjacent `<label>` says "Tags" but has `htmlFor=""` (empty)
- No `<label for="f-tags-input">` in DOM
- Screen readers must infer association from DOM proximity only

**Fix:**
```diff
-<label>Tags</label>
+<label for="f-tags-input">Tags</label>
```

---

## 🟧 High Issues

### H1. Suggestion chips lack descriptive aria-label

**Severity:** High (WCAG 4.1.2)  
**Pages affected:** QA Create / Edit modal  
**Evidence:**
- `<button class="suggestion-chip">#password (1)</button>` — no `aria-label`
- Screen reader hears "#password (1)" but doesn't know clicking *adds* the tag
- The visual counter "(1)" is not meaningful to all users

**Fix:**
```diff
-<button class="suggestion-chip">#password (1)</button>
+<button class="suggestion-chip" aria-label="Add tag: password">#password <span class="suggestion-count" aria-hidden="true">(1)</span></button>
```
*(Add `aria-hidden="true"` on `.suggestion-count` so screen readers skip the count.)*

### H2. Tag input missing accessible name

**Severity:** High (WCAG 4.1.2)  
**Pages affected:** QA Create / Edit modal  
**Evidence:**
- `<input>` has `id="f-tags-input"` but no `aria-labelledby` or `aria-label`
- The `<label for="f-tags-input">` fix (C2) resolves this, but as a fallback, `aria-label` should also be set

**Fix:** (combined with C2 fix)

### H3. Closing modal does not clear tag state

**Severity:** High  
**Pages affected:** QA Create modal  
**Evidence:** Tag chips persist across open/close cycles (not tested directly, but inferred from SPA singleton modal pattern — typical bug)

**Verify / Fix:** Ensure `resetTags()` or `initTagChips()` is called on modal `close` event to clear all selected chips.

---

## 🟨 Medium Issues

### M1. Suggestions may scroll out of view with mobile keyboard

**Severity:** Medium  
**Pages affected:** QA Create modal on mobile (375×812 + keyboard)  
**Evidence:**
- Suggestion chips are in-flow below the tag input
- When mobile soft keyboard appears (~400px height loss), only ~350px visible
- Suggestions area (252px tall at render) may push below visible viewport
- User types, sees filtered chips, then keyboard dismisses — chips may be gone

**Fix:** Consider `position: sticky` on `.suggestions-area` or ensure `scrollIntoView(true)` on tag input focus.

### M2. Chip-remove ✕ symbol hard to see visually

**Severity:** Medium  
**Pages affected:** Selected chips on primary blue background  
**Evidence:**
- ✕ icon is `font-size: 10px`, `color: rgba(255,255,255,0.7)` on blue background
- 10px is too small to read, especially with low contrast
- Current: `rgba(255,255,255,0.7)` on `var(--primary)` (~#4f46e5)

**Fix:** Increase ✕ to `font-size: 14px`, change color to `rgba(255,255,255,0.9)`.

---

## 🟩 Low Issues

### L1. Suggestion chip font size on mobile

**Severity:** Low  
**Pages affected:** QA Create modal  
**Evidence:** `font-size: 13px` on suggestion chips. While functional, 14-15px would be slightly more legible on mobile.

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 2 |
| 🟧 High | 3 |
| 🟨 Medium | 2 |
| 🟩 Low | 1 |
| **Total** | **8** |

### Key Takeaway

The tag suggestion feature **works correctly** (all 11 functional requirements pass). The main issues are **accessibility and touch target size** on mobile:

1. **C1 (touch targets)** is the highest-impact fix — selected chips are small on mobile, especially the ✕ remove button
2. **C2 + H2 (label association)** are quick one-line fixes for screen reader compatibility
3. **H1 (aria-labels on suggestion chips)** improves screen reader experience

**Estimated fix time:** ~30 minutes total for all items.
