# Accounts Domain — Test Plan

**Project:** homey_backend
**Scope:** Registration, login, OTP/Firebase phone auth, profile, addresses, chef-identity linking, admin user/chef management. As of 2026-08-15, also covers **authorization-only** checks for the highest-risk gaps found in orders/delivery (see §2a) — not full component/integration suites for those domains.
**Out of scope:** Full payments/orders/delivery/meals/pantry/fuel/social/feed/notifications suites (payments, orders, and delivery have zero broad test coverage beyond the authorization checks in §2a — see `docs/testing/FINDINGS.md` PROD-005 through PROD-009 for what's still open there)
**Author:** Automated by Claude (component/integration/sanity automation) — UAT executed by a second, independent tester
**Last updated:** 2026-08-15

## 1. Purpose

The team suspects there are bugs in the "accounts" area of the backend ahead of a production push. This plan defines four layers of testing for that domain — component, integration, sanity, and UAT — so that:

- Automated tests catch regressions going forward (none existed before this pass — see §6).
- A second tester can independently verify real-world flows without needing to read code.
- Every known/suspected defect is documented with evidence, not just a hunch.

## 2. In Scope

| Area | Files |
|---|---|
| Registration & login | `src/auth/auth.router.ts`, `src/auth/auth.service.ts` |
| OTP (MSG91) & Firebase phone auth | `src/auth/auth.service.ts`, `src/common/services/firebase.service.ts` |
| User profile & addresses | `src/users/users.router.ts`, `src/users/users.service.ts` |
| Chef↔User identity linking | `src/chefs/chefs.router.ts`, `src/chefs/chefs.service.ts` (registration only, not the full chef dashboard/catalog) |
| Admin user/chef management | `src/admin/admin.router.ts` (`/admin/users`, `/admin/chefs*`), role gating |

### 2a. Authorization-only coverage added 2026-08-15 (not full domain suites)

| Area | Files | What's covered |
|---|---|---|
| Order status ownership | `src/orders/orders.router.ts`, `src/orders/orders.service.ts` | A chef can only update their own order's status; admin can update any; see `orders.router.integration.spec.ts` |
| Delivery status role gate | `src/delivery/delivery.router.ts` | Only ADMIN can update delivery status; see `delivery.router.integration.spec.ts` |
| Shadowfax webhook secret | `src/delivery/webhooks.router.ts` | Shared-secret verification when configured; see `webhooks.router.spec.ts` |
| Rate limiting | `src/common/middleware/rateLimit.middleware.ts` | Applied to auth + webhook routes; see `rateLimit.middleware.spec.ts` |

Full component/integration coverage for payments, orders (beyond the status-ownership check), and delivery (beyond the role gate) is still open — see `docs/testing/FINDINGS.md` for the specific untested risk areas identified in the 2026-08-15 survey.
| Admin portal (separate repo) | `admin_port/` — login + session behavior only |

## 3. Test Levels & Tools

| Level | Tool | Location | Requires |
|---|---|---|---|
| Component (unit) | Jest, mocked Prisma/Redis/fetch | `src/**/*.spec.ts` | Nothing — no DB/Redis needed |
| Integration | Jest + Supertest, real app | `src/**/*.integration.spec.ts` | Local Postgres + Redis (same `.env` as `npm run start:dev`) |
| Sanity | Subset of integration tests tagged `[SANITY]`, plus a manual curl checklist | `npm run test:sanity`, `docs/testing/SANITY_CHECKLIST.md` | Same as integration, or just `curl` + a running server |
| UAT | Manual, human tester | `docs/testing/UAT_TEST_CASES_ACCOUNTS.md` | A running backend + (ideally) the admin portal + a real phone for OTP/Firebase cases |

## 4. Environment & Prerequisites

- Node version per `package.json` `engines` (`^20.19 \|\| ^22.12 \|\| >=24.0`)
- `.env` populated with `DATABASE_URL`, `REDIS_HOST`/`REDIS_PORT`(/`REDIS_USERNAME`/`REDIS_PASSWORD`/`REDIS_TLS`), `JWT_SECRET`. MSG91/Firebase keys are optional for automated tests (MSG91 mock-SMS console-logs when unset; Firebase paths aren't exercised by automation — see §7).
- `npm install` (adds `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `cross-env` as devDependencies)
- Commands:
  - `npm test` — component tests, safe anywhere, no external services
  - `npm run test:integration` — integration tests against your local Postgres/Redis; forces `OTP_BYPASS_ENABLED=true` for the test process only (never touches your real `.env`)
  - `npm run test:sanity` — fast `[SANITY]`-tagged subset of the integration tests
  - `npm run test:coverage` — component tests with coverage report

## 5. Test Data Isolation

Every row created by automated tests is tagged so it can never be confused with real data and is safely cleaned up:

- Emails end in `@homey.test` (e.g. `qa.register.<unique>@homey.test`)
- Phones start with `+91700000` (a reserved block, never a real-looking number)
- `src/test/testApp.ts` exports `cleanupQaData()`, called in every integration spec's `afterAll`, which deletes any `User`/`Chef`/`Address` rows matching those patterns — nothing else.

**Do not** reuse the `@homey.test` domain or `+91700000…` phone prefix for anything other than these automated tests.

## 6. Entry / Exit Criteria

**Entry:** `.env` is configured, local Postgres/Redis are reachable (same ones `npm run start:dev` uses), `npm install` has been run.

**Exit (automated):**
- `npm test` is green except the one intentionally `test.failing()`-marked defect-proof case (`src/users/users.service.spec.ts`, see FINDINGS.md AC-001) — if that test ever starts reporting a real failure, it means the bug was fixed and the test should be converted to a normal `test()`.
- `npm run test:integration` is green apart from the two defect-proof cases described in FINDINGS.md, and leaves zero residual `@homey.test`/`+91700000…` rows in the DB afterward.

**Exit (manual):** UAT doc fully filled in by the second tester with Pass/Fail per case and any new defects logged in FINDINGS.md.

## 7. Known Automation Gaps (must be covered manually in UAT)

- **Real MSG91 SMS delivery** — automated tests run with `OTP_BYPASS_ENABLED=true`, so the real MSG91 HTTP call path is only unit-tested with mocked `fetch`, never exercised end-to-end with a real phone.
- **Real Firebase Phone Auth tokens** — `verifyFirebasePhoneToken()` is mocked out in component tests and not called at all in integration tests (no real Firebase ID token available to automation). Must be manually verified via the mobile app / Firebase test phone numbers.
- **Chef step-3 document upload** (multipart file upload to Cloudinary) — not covered by either automated layer; verify manually.
- **Admin portal UI** (`admin_port/`) — a separate React app; automated tests only exercise the backend API it calls, not the UI itself.

## 8. Roles

- **Automated suite + Findings log:** authored and executed as part of this pass (component, integration, sanity).
- **UAT execution:** a second, independent tester runs `docs/testing/UAT_TEST_CASES_ACCOUNTS.md` and fills in Actual Result / Pass-Fail / Notes columns themselves.

## 9. Defect Severity Definitions

| Severity | Meaning |
|---|---|
| Critical | Data loss, account lockout, or security bypass in a common flow |
| High | Breaks a primary account flow (register/login/OTP) for some users |
| Medium | Incorrect/confusing behavior in a secondary flow, or a real security-relevant gap that isn't yet exploited |
| Low | Cosmetic, documentation drift, or dead code with no functional impact |

## 10. Sign-off

| Role | Name | Date | Environment tested | Verdict |
|---|---|---|---|---|
| Automation author | Claude (this pass) | 2026-08-14 | Local dev (Postgres/Redis via `.env`) | See `TEST_EXECUTION_SUMMARY.md` |
| Second tester (UAT) | _______________ | _______________ | _______________ | _______________ |
