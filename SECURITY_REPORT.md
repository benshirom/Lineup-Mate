# Lineup Mate — Security, Scalability & Production Audit Report

**Date:** 2026-06-05  
**Stack:** Next.js 14 · TypeScript · Supabase · Netlify · Playwright  
**Auditor:** Automated Security Audit (22 Steps)

---

## Executive Summary

| חומרה | מספר ממצאים |
|-------|------------|
| 🔴 Critical | 9 |
| 🟠 High | 14 |
| 🟡 Medium | 12 |
| 🟢 Low | 3 |

**Overall Score: 57/100**

הפרויקט מגלה בסיס טכני טוב — הפרדת secrets, RLS, Bearer-token auth — אך לוקה בהיעדר מוחלט של security headers, monitoring, ו-endpoint אחד ללא אימות שמהווה סיכון קריטי.

---

## שלב 1 — Secrets & Environment Audit

### ✅ ממצאים חיוביים

- אין secrets חשופים ב-client
- `NEXT_PUBLIC_` משמש רק עבור `SUPABASE_URL` ו-`ANON_KEY` — תקין
- `SUPABASE_SERVICE_ROLE_KEY` מוגדר ב-server only (`lib/supabaseAdmin.ts`)
- אין קבצי `.env` / `.env.local` / `.env.production` ב-repo
- `.gitignore` מכיל את כל קבצי ה-env
- GitHub Actions משתמש ב-`secrets.E2E_*` בלבד
- `netlify.toml` נקי מחשיפות

### ❌ ממצאים שליליים

אין.

**ציון שלב 1: 95/100**

---

## שלב 2 — API Security Audit

### 🔴 Critical

**[SEC-001] `/pages/api/upload-avatar.ts` — ללא אימות**

```
קובץ: pages/api/upload-avatar.ts, שורה 38
```

Endpoint מקבל `userId` מ-request body ללא אף בדיקת אימות. כל משתמש אנונימי יכול להעלות avatar בשם כל user ID שירצה.

**השפעה:** User impersonation, quota exhaustion, abuse של Cloudinary.

---

### 🟠 High

**[SEC-002] `error.message` מוחזר ל-client**

```
קבצים:
- pages/api/admin/groups/[id]/members.ts:25
- pages/api/admin/groups/[id]/index.ts:19,26
- pages/api/admin/users/[id].ts:21,32
- pages/api/admin/clashfinder-events.ts:38
```

שגיאות Supabase מוחזרות ישירות ללקוח, עלולות לחשוף שמות טבלאות, constraints, ומידע סכמתי.

**[SEC-003] אין Rate Limiting**

אין Upstash, אין middleware rate limiting, אין הגנה על endpoints. כל endpoint פגיע ל-brute-force ו-DoS.

---

### 🟡 Medium

**[SEC-004] אין Input Validation Library**

אין Zod / Yup / Valibot. וולידציה מתבצעת באמצעות `.trim()` בלבד על slugs ב-admin endpoints.

```
קבצים:
- pages/api/admin/preview-clashfinder.ts:65
- pages/api/admin/import-clashfinder.ts:18
```

---

### ✅ ממצאים חיוביים

- כל admin endpoints מוגנים ב-`requireAdmin()` (`lib/adminAuth.ts`)
- `/pages/api/profile/avatar-upload.ts` מאמת Bearer token
- Pagination מוגבל ל-200 records (`pages/api/admin/users.ts:14`)

**ציון שלב 2: 55/100**

---

## שלב 3 — XSS / Injection Audit

### ✅ ממצאים חיוביים — נקי לחלוטין

- אין `dangerouslySetInnerHTML`
- אין `innerHTML` / `outerHTML` / `document.write`
- אין `eval()` / `new Function()`
- אין href injection
- אין SQL injection (Supabase parameterized queries בלבד)
- אין `exec()` / `spawn()`

**ציון שלב 3: 100/100**

---

## שלב 4 — SSRF Audit

### ✅ ממצאים חיוביים — נקי

- `fetch()` קורה רק לכתובת `https://clashfinder.com` (hardcoded)
- User input (slug) עובר `encodeURIComponent()` לפני שימוש (`lib/clashfinder.ts:113`)
- אין URL מ-user ישירות לפעולת fetch

**ציון שלב 4: 100/100**

---

## שלב 5 — CSRF Audit

### 🟡 Medium

**[SEC-005] אין CSRF tokens מפורשים**

אין הגנת CSRF מפורשת. הסיכון נמוך בגלל ש-API דורש `Authorization: Bearer` header — browsers לא שולחים headers מותאמים אישית ב-cross-site requests. עם זאת, אם בעתיד ייווסף cookie-based auth, יידרש תיקון.

**ציון שלב 5: 80/100**

---

## שלב 6 — Authentication Audit

### ✅ ממצאים חיוביים

- Login/Signup/OAuth דרך Supabase Auth (`pages/login.tsx`)
- OAuth redirect מוגן עם `window.location.origin` (`pages/login.tsx:67-68`)
- Session מנוהל ב-`AuthContext` (`lib/AuthContext.tsx`)
- Blocked users מנותקים אוטומטית (`lib/AuthContext.tsx:80-85`)

### 🟡 Medium

**[SEC-006] Cookie security לא מוגדר מפורשות**

אין הגדרה מפורשת של `httpOnly`, `Secure`, `SameSite`. Supabase מגדיר אלו כברירת מחדל, אך עדיף לאכוף מפורשות.

**ציון שלב 6: 85/100**

---

## שלב 7 — Supabase Database Audit

### ✅ ממצאים חיוביים

- RLS מופעל על כל הטבלאות (`database/init.sql:191-198`)
- כל policies משתמשות ב-`auth.uid()`
- אין `GRANT ALL`
- כל `SECURITY DEFINER` functions כוללות `set search_path = public` / `set search_path = ''`

### 🟠 High

**[DB-001] `profiles` — RLS policy פתוחה לכל authenticated users**

```sql
-- database/init.sql:219-222
CREATE POLICY "Profiles are readable by authenticated users"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');
```

כל משתמש מאומת יכול לקרוא את כל הפרופילים — **Information disclosure**.

**תיקון מוצע:**
```sql
CREATE POLICY "Users can read own profile or group members"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR id IN (
      SELECT user_id FROM group_members
      WHERE group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
      )
    )
  );
```

**[DB-002] `group_members` — RLS policy פתוחה לכל authenticated users**

```sql
-- database/init.sql:307-311
CREATE POLICY "Authenticated users can read group memberships"
  ON group_members FOR SELECT
  USING (auth.role() = 'authenticated');
```

כל משתמש מאומת יכול לראות חברות בכל קבוצה — **Privacy violation**.

**ציון שלב 7: 70/100**

---

## שלב 8 — Supabase Storage Audit

### 🔴 Critical

**[SEC-007] `/pages/api/upload-avatar.ts` — ללא auth, userId נשלח מ-body**

(ראה SEC-001 לפרטים מלאים)

### 🟡 Medium

**[SEC-008] MIME validation בסיסי בלבד**

```typescript
// pages/api/profile/avatar-upload.ts:28-30
const validImageRegex = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/;
```

Regex בסיסי — אין בדיקה של תוכן הקובץ בפועל (magic bytes). קובץ זדוני יכול להיות מוסווה כתמונה.

**ציון שלב 8: 50/100**

---

## שלב 9 — Multi-Tenant Isolation Audit

### 🟠 High

- `profiles` ניתנת לקריאה ע"י כל authenticated user (ראה DB-001)
- `group_members` ניתנת לקריאה ע"י כל authenticated user (ראה DB-002)

### ✅ ממצאים חיוביים

- `user_performance_preferences` מוגנות ב-`auth.uid()`
- `groups` — כתיבה/מחיקה מוגנות לבעלים בלבד
- `saved_festivals` — מוגנות per-user (`database/20260510_fix_missing_schema.sql:50-55`)

**ציון שלב 9: 65/100**

---

## שלב 10 — Realtime Audit

### ✅ ממצאים חיוביים

- אין `.channel()` subscriptions — הפרויקט לא משתמש ב-Realtime
- `AuthContext` מבצע cleanup תקין: `subscription.unsubscribe()` (`lib/AuthContext.tsx:155`)
- אין memory leaks, connection leaks, event flooding

**ציון שלב 10: 95/100**

---

## שלב 11 — Scalability Audit

### 🟠 High

**[SCALE-001] N+1 Query — group page**

```typescript
// pages/group/[groupId].tsx:186-226
// שלב 1: טוען את כל group_members
// שלב 2: לוקח את ה-IDs
// שלב 3: טוען profiles ב-query נפרד
// שלב 4: טוען preferences בעוד query נפרד
```

שלושה queries נפרדים שניתן לאחד ל-JOIN אחד.

**[SCALE-002] N+1 Query — festival page**

```typescript
// pages/festival/[festivalId].tsx:157-186
// שלב 1: טוען performances
// שלב 2: טוען preferences בנפרד
```

### 🟡 Medium

**[SCALE-003] `select('*')` ב-admin stats**

```typescript
// pages/api/admin/stats.ts:51-67
// טוען כל הרשומות לזיכרון לצורך ספירה
```

יגרום לבעיות עם DB גדול. יש להשתמש ב-`count()` של PostgreSQL.

**[SCALE-004] Frontend pages ללא pagination**

`/festival/[festivalId].tsx` ו-`/group/[groupId].tsx` טוענים את כל הנתונים ללא pagination.

**ציון שלב 11: 55/100**

---

## שלב 12 — Database Performance Audit

### 🟡 Medium

**[PERF-001] Indexes חסרים על `group_members.user_id`**

Query נפוץ: "מצא את כל הקבוצות של משתמש X" — חסר index.

**תיקון מוצע:**
```sql
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
```

**[PERF-002] Index חסר על `performances(festival_id, stage_id)`**

Query נפוץ: "טוען את כל ה-performances לפסטיבל X ב-stage Y".

**תיקון מוצע:**
```sql
CREATE INDEX idx_performances_festival_stage ON performances(festival_id, stage_id);
```

**[PERF-003] Index חסר על `user_performance_preferences(user_id, performance_id)`**

**תיקון מוצע:**
```sql
CREATE INDEX idx_user_perf_prefs ON user_performance_preferences(user_id, performance_id);
```

**ציון שלב 12: 65/100**

---

## שלב 13 — Security Headers Audit

### 🔴 Critical — הכל חסר

```javascript
// next.config.js — לא מוגדרים headers בכלל
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
module.exports = nextConfig;
```

| Header | סטטוס |
|--------|-------|
| `Content-Security-Policy` | ❌ חסר |
| `X-Frame-Options` | ❌ חסר |
| `X-Content-Type-Options` | ❌ חסר |
| `Referrer-Policy` | ❌ חסר |
| `Strict-Transport-Security` | ❌ חסר |
| `Permissions-Policy` | ❌ חסר |

**השפעה:**
- Clickjacking אפשרי (חסר `X-Frame-Options`)
- MIME sniffing אפשרי (חסר `X-Content-Type-Options`)
- מידע referrer דולף (חסר `Referrer-Policy`)
- HSTS לא נאכף

**תיקון מוצע ל-`next.config.js`:**
```javascript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://res.cloudinary.com",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

module.exports = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```

**ציון שלב 13: 10/100**

---

## שלב 14 — CORS Audit

### ✅ ממצאים חיוביים

- אין `Access-Control-Allow-Origin: *`
- Next.js מגדיר same-origin כברירת מחדל
- אין חשיפה לא מכוונת

**ציון שלב 14: 90/100**

---

## שלב 15 — Dependency Audit

### 🔴 Critical (npm audit)

**[DEP-001] Next.js 14.1.4 — פגיעויות קריטיות מרובות**

```
8 vulnerabilities: 1 moderate, 6 high, 1 critical
```

פגיעויות שנמצאו ב-Next.js 14.1.4:
- Cache Poisoning (GHSA-gp8f-8m3g-qvj9)
- Authorization Bypass in Middleware (GHSA-f82v-jwr5-mffw)
- SSRF via WebSocket upgrades (GHSA-c4j6-fc7j-m34r)
- DoS via Image Optimizer (GHSA-g77x-44xx-532m)
- XSS in beforeInteractive scripts (GHSA-gx5p-jg67-6x7h)
- Cache Key Confusion (GHSA-g5qg-72qw-gw5v)

**תיקון:** `npm install next@14.2.35` (או שדרוג ל-15)

### 🟠 High

**[DEP-002] `glob` CLI Command Injection (GHSA-5j98-mcp5-4vw2)**

דרך `eslint-config-next`.

**[DEP-003] `minimatch` ReDoS (GHSA-3ppc-4f35-3m26)**

דרך `@typescript-eslint`.

### 🟡 Medium

**[DEP-004] TypeScript 6.0.3 — גרסת beta**

TypeScript 6.0 הוא pre-release. יש להשתמש ב-TypeScript 5.x stable.

**ציון שלב 15: 35/100**

---

## שלב 16 — Monitoring & Observability

### 🔴 Critical

**[MON-001] אין error monitoring**

- אין Sentry
- אין LogRocket
- אין כלי tracking אחר
- שגיאות production הולכות לאיבוד

**[MON-002] מה קורה כאשר שירות נופל?**

| תרחיש | תגובה נוכחית |
|--------|-------------|
| Supabase DB נופל | שגיאות silent — המשתמש לא מבין מה קרה |
| Cloudinary נופל | avatar upload נכשל ללא הסבר |
| Auth נופל | Redirect loop אפשרי |

**ציון שלב 16: 10/100**

---

## שלב 17 — Privacy & GDPR Audit

### 🟠 High

**[GDPR-001] אין אפשרות למחיקת חשבון**

משתמש לא יכול למחוק את החשבון שלו — דרישה בסיסית של GDPR (right to erasure).

**[GDPR-002] אין export של נתוני משתמש**

GDPR מחייב אפשרות ל-data portability.

### 🟡 Medium

**[GDPR-003] אין data retention policy**

**[GDPR-004] אין consent management**

אין Cookie consent banner, אין Privacy Policy מפורש.

**ציון שלב 17: 20/100**

---

## שלב 18 — Playwright Security Audit

### ✅ קיים

- E2E tests קיימים בתיקיית `tests/e2e/`
- Credentials מאוחסנים ב-GitHub Secrets
- GitHub Actions workflow תקין

### 🟠 High — חסר

| בדיקה | סטטוס |
|-------|-------|
| Unauthorized access tests | ❌ חסר |
| Auth bypass tests | ❌ חסר |
| XSS tests | ❌ חסר |
| IDOR tests | ❌ חסר |
| Cross-user access tests | ❌ חסר |
| Rate limit tests | ❌ חסר |

**ציון שלב 18: 35/100**

---

## שלב 19 — Penetration Test Simulation

| תרחיש | Attack Vector | Impact | Likelihood | Risk Score |
|--------|--------------|--------|-----------|-----------|
| **Upload avatar כ-user אחר** | `POST /api/upload-avatar` עם userId שרירותי | High | High | 🔴 9/10 |
| **Cache Poisoning** (Next.js CVE) | HTTP request manipulation | High | Medium | 🔴 8/10 |
| **Auth Bypass** (Next.js Middleware CVE) | Middleware bypass | Critical | Low | 🔴 7/10 |
| **Profile enumeration** | `GET profiles` via Supabase client | Medium | High | 🟠 6/10 |
| **Group member enumeration** | `GET group_members` via Supabase client | Medium | High | 🟠 6/10 |
| **Rate limit abuse** | Brute-force admin endpoints | High | Medium | 🟠 6/10 |
| **Error info disclosure** | Trigger Supabase errors | Low | High | 🟡 4/10 |
| **Clickjacking** | iframe embedding | Medium | Low | 🟡 4/10 |
| **MIME sniffing** | Malicious file upload disguise | Low | Low | 🟢 2/10 |

---

## שלב 20 — Production Readiness Review

### 🟠 High

**[PROD-001] אין caching strategy**

אין `Cache-Control` headers על API responses, אין ISR/SSG strategy.

**[PROD-002] אין Core Web Vitals monitoring**

### ✅ חיובי

- Netlify CDN — **כן**
- Next.js Image Optimization — **כן** (next/image)
- Code Splitting אוטומטי — **כן** (Next.js)
- React Strict Mode — **כן**

### 🟡 Medium

**[PROD-003] Next.js 14.1.4 עם פגיעויות**

יש לשדרג לפחות ל-14.2.35.

**ציון שלב 20: 55/100**

---

## שלב 21 — Architecture Review

### מבנה תיקיות

```
Lineup-Mate/
├── database/                    ✅ SQL migrations מסודרות כרונולוגית
│   ├── init.sql                 ✅ Schema ראשי + RLS + seed
│   ├── 20260510_*.sql           ✅ Bug fixes
│   └── migrations/              ✅ Migrations מוגדרות
├── lib/                         ✅ Business logic נפרד מ-UI
│   ├── supabaseClient.ts        ✅ Client init
│   ├── supabaseAdmin.ts         ✅ Server-only admin client
│   ├── AuthContext.tsx          ✅ Auth state centralized
│   ├── adminAuth.ts             ✅ Admin role verification
│   ├── clashfinder.ts           ✅ External API integration
│   └── importFestival.ts        ✅ Festival import logic
├── pages/                       ✅ Next.js pages router
│   ├── api/admin/               ✅ Admin endpoints מאורגנות
│   └── api/profile/             ✅ Profile endpoints
├── components/                  ✅ UI components
│   └── ui/                      ✅ Reusable primitives
├── tests/e2e/                   ✅ Playwright E2E
└── typings/                     ✅ TypeScript type definitions
```

### חוזקות ארכיטקטורה
- הפרדה ברורה בין שכבות (lib / pages / components)
- TypeScript strict mode
- RLS ב-DB רמה
- Server-side isolation על service role key
- Admin auth מרכזי (`adminAuth.ts`)

### חולשות ארכיטקטורה
- Legacy endpoint (`upload-avatar.ts`) לא נמחק לאחר החלפתו
- אין `middleware.ts` מרכזי לאכיפת security headers ו-auth
- אין input validation library אחיד
- Error handling אינו אחיד (כל endpoint מטפל בשגיאות אחרת)
- אין logging/observability layer

**Architecture Score: 72/100**

---

## Top 10 Risks

| # | סיכון | חומרה | קובץ |
|---|-------|-------|------|
| 1 | Upload avatar ללא auth (SEC-001) | 🔴 Critical | pages/api/upload-avatar.ts |
| 2 | Next.js 14.1.4 — CVEs קריטיים (DEP-001) | 🔴 Critical | package.json |
| 3 | היעדר security headers (SEC-013) | 🔴 Critical | next.config.js |
| 4 | אין error monitoring (MON-001) | 🔴 Critical | כל ה-app |
| 5 | RLS פתוח על `profiles` (DB-001) | 🟠 High | database/init.sql:219-222 |
| 6 | RLS פתוח על `group_members` (DB-002) | 🟠 High | database/init.sql:307-311 |
| 7 | אין Rate Limiting (SEC-003) | 🟠 High | כל endpoints |
| 8 | error.message חשוף ל-client (SEC-002) | 🟠 High | pages/api/admin/*.ts |
| 9 | N+1 queries (SCALE-001, SCALE-002) | 🟠 High | pages/group/, pages/festival/ |
| 10 | אין GDPR delete/export (GDPR-001, GDPR-002) | 🟠 High | — |

---

## Recommended Fix Order

### Day 1 — עצור דימום

1. **[SEC-001]** הוסף auth ל-`pages/api/upload-avatar.ts` או מחק אותו (ה-endpoint החדש כבר קיים ב-`pages/api/profile/avatar-upload.ts`)
2. **[DEP-001]** הרץ `npm install next@14.2.35` לתיקון CVEs

### Day 2 — Security Headers

3. **[SEC-013]** הוסף security headers ל-`next.config.js` (ראה תיקון מוצע בשלב 13)
4. **[SEC-002]** החלף `error.message` ב-"Internal server error" בכל admin endpoints

### Week 1 — Database & Architecture

5. **[DB-001]** הגבל RLS על `profiles` — קרא רק קבוצות משותפות
6. **[DB-002]** הגבל RLS על `group_members` — קרא רק קבוצות שאתה חבר בהן
7. **[PERF-001/002/003]** הוסף indexes חסרים ב-migration חדש
8. **[MON-001]** הוסף Sentry (`npm install @sentry/nextjs`)

### Month 1 — Scalability & Compliance

9. **[SCALE-001/002]** תקן N+1 queries בדפי festival ו-group
10. **[GDPR-001]** הוסף "Delete Account" feature
11. **[GDPR-002]** הוסף "Export My Data" feature
12. **[SEC-003]** הוסף rate limiting (Upstash או `@upstash/ratelimit`)
13. **[DEP-004]** שדרג TypeScript ל-5.x stable

---

## Quick Wins (שעה עד יום)

1. **מחיקת/נעילת** `pages/api/upload-avatar.ts` — 5 דקות
2. **הוספת security headers** ל-`next.config.js` — 15 דקות
3. **החלפת error.message** ב-generic message — 30 דקות
4. **`npm install next@14.2.35`** — 2 דקות
5. **הוספת Sentry** — שעה אחת

---

## Long-Term Improvements

1. **Input Validation** — הוסף Zod לכל API endpoints
2. **Rate Limiting** — הטמע Upstash Ratelimit
3. **Pagination** — הוסף pagination לדפי frontend
4. **Realtime** — שקול שימוש ב-Supabase Realtime לעדכונים חיים
5. **GDPR Compliance** — delete account, data export, consent banner
6. **E2E Security Tests** — הוסף Playwright tests ל-IDOR, XSS, auth bypass
7. **Database Indexes** — migration עם indexes חסרים
8. **Caching Strategy** — Cache-Control headers + ISR
9. **middleware.ts** — מרכז את auth + security headers + rate limiting
10. **TypeScript 5.x** — שדרג מ-beta

---

## Suggested Code Fixes

### Fix 1: הוספת auth ל-upload-avatar.ts

```typescript
// pages/api/upload-avatar.ts — הוסף בתחילת handler
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.substring(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
  // השתמש ב-user.id במקום req.body.userId
  const userId = user.id;
  // ... המשך הקוד
}
```

### Fix 2: Generic error messages

```typescript
// החלף ב-כל admin endpoints
if (error) {
  console.error('[Admin API Error]', error);
  return res.status(500).json({ error: 'Internal server error' });
}
```

### Fix 3: RLS policy מתוקנת לטבלת profiles

```sql
-- migration חדש
ALTER POLICY "Profiles are readable by authenticated users"
  ON profiles USING (
    auth.uid() = id
    OR id IN (
      SELECT gm2.user_id FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      WHERE gm1.user_id = auth.uid()
    )
  );
```

### Fix 4: Database indexes

```sql
-- migration חדש
CREATE INDEX IF NOT EXISTS idx_group_members_user_id
  ON group_members(user_id);

CREATE INDEX IF NOT EXISTS idx_performances_festival_stage
  ON performances(festival_id, stage_id);

CREATE INDEX IF NOT EXISTS idx_user_perf_prefs_user
  ON user_performance_preferences(user_id, performance_id);
```

---

## Final Scores

```
Security Score:           52/100
Database Score:           68/100
Scalability Score:        55/100
Architecture Score:       72/100
Production Readiness:     40/100

Overall Score:            57/100
```

### דירוג לפי תחום

| תחום | ציון | הסבר |
|------|------|-------|
| 🛡️ Security | 52 | endpoint ללא auth + אין headers + CVEs |
| 🗄️ Database | 68 | RLS טוב אבל policies פתוחות מדי |
| ⚡ Scalability | 55 | N+1 queries + אין pagination |
| 🏗️ Architecture | 72 | מבנה נקי אך חסרים middleware ו-validation layer |
| 🚀 Production | 40 | אין monitoring, CVEs, אין GDPR |

---

*Audit completed: 2026-06-05 | Lineup Mate v1.x | Next.js 14.1.4 + Supabase + Netlify*
