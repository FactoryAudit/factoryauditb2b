# FactoryAuditB2B V2.2 — Redirect & Canonical Map

**Scope:** V2.2 Commercial Rules Unification + SEO URL/canonical cleanup (spec §13, §40–§50, §75).
**Status:** ✅ implemented · 2026-09-17

---

## 1. URL Redirects (301/308)

`/membership` is permanently merged into `/pricing` as the **Founding Buyer** option
(anchored at `#founding-buyer`). Two mechanisms enforce it:

### 1a. `next.config.mjs` — `redirects()` (permanent = 308)

| Source | Destination | Type | Reason |
| --- | --- | --- | --- |
| `/membership` | `/pricing` | permanent (308) | Single pricing truth source; Founding Buyer lives under /pricing |
| `/:locale/membership` | `/:locale/pricing` | permanent (308) | Locale-prefixed variant of the above |

Anchored target for both: `/pricing#founding-buyer` (set at the page level via `localePath`).

### 1b. Page-level fallback — `app/[locale]/membership/page.tsx`

`force-dynamic` route that calls `redirect(localePath(locale, "/pricing") + "#founding-buyer")`.
This is the in-app兜底 for any direct hit that bypasses the config redirect (e.g. locale
resolution, client transitions). It guarantees the Founding Buyer anchor is preserved.

> Note: Next.js `permanent: true` emits **308** (not 301). 308 is correct here — it
> preserves the request method (GET) and is the modern permanent-redirect code. Do not
> switch to 301.

---

## 2. Canonical Policy (self-referential)

All core commercial/SEO pages emit a **self-canonical** via the shared layout
(`app/[locale]/layout.tsx` → `canonicalFor(locale, x-pathname)`). The `x-pathname`
header carries the real pathname so each route canonicalizes to itself, including query/
anchor-free form.

| Page | Canonical | Index | In sitemap |
| --- | --- | --- | --- |
| `/[locale]/pricing` | self | yes | yes |
| `/[locale]/services/inspection` | self | yes | yes |
| `/[locale]/tools/supplier-risk-calculator` | self | yes | yes |
| `/[locale]/factory-audit/request` | self | yes | yes |
| `/[locale]/join-supplier-network` | self | yes | yes |
| `/[locale]/membership` | **removed** | no | **no** (308 → /pricing) |

Internal links that previously pointed at `/membership` now point at
`/pricing#founding-buyer` (footer, account menu, supplier detail, register, suppliers
list, checkout return). See grep evidence in `scripts/v22-commercial-regression.mjs` §6.

---

## 3. Sitemap (`app/sitemap.ts`)

- `/membership` removed from the `core` route array (spec §75).
- `/pricing`, `/services/inspection`, `/tools/supplier-risk-calculator`,
  `/factory-audit/request`, `/join-supplier-network` retained with self-canonical.

Verified by regression check `[4] sitemap omits /membership`.

---

## 4. llms.txt (`app/llms.txt/route.ts`)

The `[Founding Buyer](${BASE}/pricing#founding-buyer)` link replaced the old
`[Buyer Membership](${BASE}/membership)` entry (line 61).

---

## 5. Analytics events retired

`membership_page_view` / `membership_cta` events removed from `lib/analytics.ts`
`ANALYTICS_EVENTS`. The Founding Buyer surface is now covered by the
`founding_buyer_view` / `founding_buyer_checkout_start` / `founding_buyer_purchase`
funnel (V2.2 §48/§52).

---

## 6. Rollback

To revert: remove the two entries from `next.config.mjs` `redirects()`, restore
`/membership` in `app/sitemap.ts`, and un-delete `app/[locale]/membership/page.tsx`
(if a standalone membership page is wanted again). No DB change required — this is
pure routing/SEO, no data migration.
