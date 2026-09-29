# Careers Final Acceptance Report

Date: 2026-09-25
Scope: verify existing `/careers` MVP (no new features, no ATS / DB / accounts / job board / top-nav change)

## 1. TypeScript
PASS

`npx tsc --noEmit` → 0 errors (run 3 times: baseline, post-fix, pre-commit).

## 2. i18n
PASS

Languages:
en / zh / zh-TW / es / de / fr / pt / ja / ar

- 9 locales: 3114 leaves each, 2549 keys each, key sets identical to en (0 missing / 0 extra)
- `careers` namespace: 67 keys, all non-empty in all 9 locales
- `footer` added keys (workWithUs / workWithUsLead / workWithUsCountries): present in all 9
- No stale `3044` leaf-count constant remaining anywhere in the repo
- Leaf-count gate constants synced across the regression / build scripts

## 3. Careers Page
PASS

- `/careers` SSG in 9 locales; entry is the footer "Work With Us" band only (top nav untouched)
- Hero, Auditors group (6), Other Roles group (6), category chips, form, privacy note all render
- metadata + canonical `https://factoryauditb2b.com/careers`, `index: true` (no accidental noindex)

## 4. Careers API
PASS

`POST /api/careers` (dynamic route) — 37/37 assertions pass against the real bundled route handler:
- rate limit first (5/hour/IP, 429 at #6)
- required: fullName, country, role, specialization, availability, email, CV
- negative: >5MB, .exe, .zip, .jpg, spoofed MIME + .pdf name → rejected
- hostile input: 5000-char name (clamped), HTML string (plain-text email, no html part),
  CRLF in name (stripped), path-traversal filename (`../../../../etc/passwd.pdf` → `passwd.pdf`),
  special-char filename (`____.pdf`) — no 500, no crash

## 5. CV Validation
PASS

Allowed: PDF / DOC / DOCX
Max: 5MB

Server-side re-check (client is never trusted): MIME whitelist AND extension whitelist,
filename sanitised (path separators, control chars, non `[A-Za-z0-9._-]` → `_`, 120 chars).

## 6. Email Subject
PASS

Example:
`[Auditor Application] Vietnam - SMETA - Nguyen Van A`
`[Auditor Application] China - BSCI - Li Wei`

Empty fields degrade to `—` (never `undefined` / `null` / internal keys).
CR/LF and control characters are stripped (header-injection safe).

## 7. Email Body
PASS

Human-readable values only, no internal enums:
`Role: Auditor`, `Availability: Available for travel`, `Country / Region: Vietnam`,
`Specialization: SMETA`, plus name / city / years / languages / email / phone / LinkedIn /
introduction / locale.

## 8. CV Attachment
PASS

Attachment reaches the mail payload: correct filename, extension preserved,
base64 intact (round-trips back to the original PDF bytes), non-empty.
Verified via the real `notifyAdminCareerApplication` with a captured HTTP payload.

## 9. Smoke Test
PASS

Production build served via `next start`:
- en / zh / zh-TW / ja / ar → 200, hero + form render
- all 13 fields present, 5 Availability values, 4 Country values, 5 Role values
- 6 Auditor + 6 Other Role directions, chips, privacy note, CV hint, submit button
- canonical / no noindex / sitemap.xml contains 9 `/careers` URLs / llms.txt contains Work With Us
- footer on home page links to `/careers`

## 10. Production Build
PASS

`next build` → `NEXT_BUILD_EXIT=0`, compiled in 13.8 min, 2063/2063 static pages.
`/[locale]/careers` prerendered (en, zh, es, …), `/api/careers` dynamic, `sitemap.xml` / `llms.txt` present.

Note: 4 earlier build attempts hung or exited with no output. Root cause was **environmental**:
system drive C: (which hosts `TMP`) was 100% full (1.3 GB free). After pointing
`TMP`/`TEMP` to `D:\_fab_tmp` the build completed normally. No Careers code error was involved.

## 11. Environment Variables
NOTIFY_ADMIN_EMAIL: CONFIGURED
MAIL_PROVIDER: CONFIGURED
MAIL_HTTP_KEY: CONFIGURED

Confirmed in local `.env` and as Cloudflare Workers secrets (`wrangler secret list`),
names match those read by `lib/notify.ts`. Values are not stored in this report.

## 12. Git
COMMITTED

Commit: `12f5f29` — feat(careers): add multilingual careers application flow
(29 files; CS-E work-in-progress files deliberately left uncommitted)

The commit was also pushed to `origin/main` (`e01b913..12f5f29`).

## Defects found and fixed during acceptance
1. **P0** `sendMail()` destructured only `to/subject/text/html` and silently dropped
   `attachments` — the CV would never have reached the inbox. Now passes the input through.
2. `careerApplicationSubject()` did not strip CR/LF: a crafted name could inject extra
   header lines into the subject. Now collapsed to single-line safe text.
3. Delivery failure produced no server-side signal (mail layer stays fail-open by design);
   `/api/careers` now logs an explicit error without secrets.
4. Role and Availability selects reused `phCountry` ("Select country / region") as placeholder;
   now uses the existing neutral `toolsUi.riskAssessment.selectOption` (no dictionary change).

## Final Status

READY FOR PRODUCTION (code accepted — production deployment not yet executed)

## Remaining Risk
- **Not deployed yet.** The only deploy attempt was triggered unintentionally and stopped at
  the populate step (`[populate] 自检失败：页面缓存为空`), so production is unchanged.
  Real go-live needs: rebuild → `scripts/populate-static-assets-cache.cjs` → `node scripts/cf-release.cjs`.
- Mail layer remains globally **fail-open**: with the current config mail is delivered; if the
  provider key is removed or the upstream returns 5xx, the page still shows "received" and the
  failure only appears as a server-side error log. This is pre-existing architecture, unchanged.
- No Vietnamese (vi) locale on the site — Vietnamese visitors land on the English page.
- No `hreflang` tags are emitted on any page (home / about / careers). Pre-existing site-wide
  behaviour, not introduced by Careers; worth a separate fix.
- Build environment is fragile: system drive C: is at 100% (1.3 GB free). Any Node build that
  needs temp space may hang or die. Free space or point TMP to another drive before building.
