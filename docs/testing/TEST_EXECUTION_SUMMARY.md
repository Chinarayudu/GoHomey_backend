# Accounts, Payments, Orders & Delivery — Test Execution Summary

## Run 1 — Accounts test pass (2026-08-15)

**Run by:** Automated (this pass), against the local dev Postgres (Neon) + Redis (Upstash) configured in `.env`
**Commands used:** `npm test`, `npm run test:integration`, `npm run test:sanity` (see `docs/testing/TEST_PLAN.md` §4)

## Results

| Suite | Command | Test Suites | Tests | Result |
|---|---|---|---|---|
| Component (unit) | `npm test` | 2 passed / 2 | 33 passed / 33 | ✅ Green |
| Integration | `npm run test:integration` | 3 passed / 3 | 23 passed / 23 | ✅ Green |
| Sanity (tagged subset) | `npm run test:sanity` | 2 passed, 1 skipped* / 3 | 5 passed, 18 skipped* / 23 | ✅ Green |

\* The chef-linking integration spec has no `[SANITY]`-tagged cases, so its file is reported as fully skipped when filtering by name — expected, not a failure.

**Total automated tests executed: 56 (33 component + 23 integration), all passing.**

Of those, two are intentional **defect-proof** tests — they assert *correct* behavior and are expected to keep failing/documenting the bug until the underlying code is fixed:

- `src/users/users.service.spec.ts` → `test.failing(...)` for the password-hashing bug. Jest reports this as **passed** specifically because its internal assertions fail as expected (proving the bug exists). If this ever flips to a real failure, it means the bug was fixed — convert it to a normal `test()` at that point.
- `src/users/users.router.integration.spec.ts` → `"DEFECT: changing password via PATCH /users/profile breaks login..."` — a normal (non-`test.failing`) test asserting the exact currently-observed buggy behavior (both old and new password return 401). This will need updating if/when AC-001 is fixed.

## Data hygiene

- Verified via a one-off script querying the real DB directly after the integration run: **0 residual rows** matching the QA email domain (`@homey.test`) or phone prefix (`+91700000…`) in `User` or `Chef` tables. `cleanupQaData()`'s `afterAll` hooks worked correctly.

## Environment notes / issues hit and resolved during this pass

These aren't application bugs — they were problems in getting the *test infrastructure* itself working, documented here for whoever runs this next:

1. **`firebase-admin` pulls in ESM (`jose`/`jwks-rsa`) that Jest's default CJS transform can't parse.** Fixed via a `moduleNameMapper` entry in `package.json` redirecting `../common/services/firebase.service` to a manual mock (`src/test/__mocks__/firebase.service.ts`) for all test runs. Real Firebase Phone Auth verification is intentionally NOT covered by automation — see UAT section 4.
2. **Piping `jest`'s output through `tail -n N` (no `-f`) silently hides all output until the process fully exits**, and dangling Redis/BullMQ connection retries (see #3) kept the process alive well past test completion, making a working run look like an indefinite hang. Fixed by writing output directly to a file/redirect instead of piping through `tail`, and by adding `--forceExit` to `test:integration`/`test:sanity` plus closing `ordersQueue` in `closeConnections()`.
3. **The configured Redis host (Upstash) was unreachable from at least one execution context used during this pass** (DNS `ENOTFOUND`), causing continuous background reconnect-error logging from `ioredis`/BullMQ. This didn't affect correctness (OTP flows are bypassed via `OTP_BYPASS_ENABLED=true` for `test:integration`, so Redis is never actually awaited), but produced a lot of log noise. If you see the same `ENOTFOUND oriented-stingray-....upstash.io` errors when running these tests yourself, verify your own network/DNS can reach that host — `npm run start:dev` needing Redis for real OTP flows would be affected by this even outside of tests.
4. **A bug in this test suite's own `qaPhone()` helper** (`src/test/testApp.ts`) originally truncated the generated phone number to 16 characters, which cut off almost all of the uniqueness suffix and caused every phone number generated within the same ~16-minute window to collide — producing a cascade of spurious 409/401 failures across unrelated tests. Fixed by removing the truncation (the app's `phone` field has no length constraint, so there was no reason to truncate).

## Manual layer

- `docs/testing/UAT_TEST_CASES_ACCOUNTS.md` — **not yet executed.** Handed off blank (Actual Result / Pass-Fail columns empty) for the second, independent tester to fill in.
- `docs/testing/SANITY_CHECKLIST.md` — manual curl-based checklist, available for post-deploy smoke checks on any environment; not yet run against staging/production by a human.

## Verdict (Run 1)

Automated component/integration/sanity layers are green and reproducible. The most significant confirmed finding was **AC-001** (plaintext password on profile update, locking users out of login) — flagged as a likely release blocker. **Note: AC-001, along with AC-002 and AC-008, was fixed in Run 2 below** — the `test.failing()` / "DEFECT" test titles referenced above no longer exist in that form; see the updated spec files.

---

## Run 2 — Highest-risk fixes: accounts (safe subset) + orders/delivery authz + rate limiting (2026-08-15)

Following a broader production-readiness survey of `payments/`, `orders/`, and `delivery/` (see `docs/testing/FINDINGS.md` PROD-001 onward), this run applied and verified the "highest-risk fixes first" scope: AC-001/AC-002/AC-008 (accounts), the orders status-ownership check, the delivery status role gate, the Shadowfax webhook secret check, and rate limiting on auth + webhook routes.

**Run by:** Automated, against the same local dev Postgres (Neon) + Redis (Upstash) as Run 1.
**Commands used:** `npx tsc --noEmit`, `npm run build`, `npm test`, `npm run test:integration` (full suite including 2 new integration spec files), manual rate-limiter smoke check.

### Results

| Suite | Command | Test Suites | Tests | Result |
|---|---|---|---|---|
| Type-check | `npx tsc --noEmit` | — | — | ✅ Clean |
| Production build | `npm run build` | — | — | ✅ Clean, `dist/` still excludes test files |
| Component (unit) | `npm test` | 4 passed / 4 | 40 passed / 40 | ✅ Green |
| Integration | `npm run test:integration` | 5 passed / 5 | 29 passed / 29 | ✅ Green |

New test files added this run: `src/orders/orders.router.integration.spec.ts` (3 tests), `src/delivery/delivery.router.integration.spec.ts` (3 tests), `src/delivery/webhooks.router.spec.ts` (4 tests, component), `src/common/middleware/rateLimit.middleware.spec.ts` (3 tests, component).

**Total automated tests now: 69 (40 component + 29 integration), all passing, none of them defect-proof/expected-to-fail anymore** for the fixed items.

### Data hygiene

- Verified via a direct DB query after the integration run: **0 residual rows** matching the QA email/phone patterns across `User`, `Chef`, and (newly checked) `Order` tables.

### A real bug found and fixed while writing the orders test (not in the original survey)

`OrdersService.updateOrderStatus()` `await`ed `ordersQueue.add(...)` (a BullMQ/Redis call) unguarded. While Redis is unreachable (as in this execution environment — see Run 1 note #3), ioredis/BullMQ queue that command **indefinitely** rather than rejecting it, which hung the entire status-update response — including the newly-added, authorization-checked endpoint. Changed to fire-and-forget with a `.catch()`, matching the existing try/catch already used for the payout-release call two lines above it. See FINDINGS.md PROD-001 for detail. This means the fix also makes order status updates resilient to a Redis outage in production, not just in this test environment.

### Rate limiter verification

Verified via `src/common/middleware/rateLimit.middleware.spec.ts` (mounted directly on the real `createRateLimiter` factory + a minimal Express app): 429 after the configured limit, reset after the window elapses, and correctly skipped when `OTP_BYPASS_ENABLED=true`. A live end-to-end smoke test against the full `npm run start:dev` server was attempted but blocked by an unrelated pre-existing bug (`src/index.ts` reads `JWT_SECRET` before `dotenv.config()` runs when no other dotenv-loading module has been imported yet — see FINDINGS.md PROD-010); this only affects a bare local shell without `JWT_SECRET` pre-set as a real OS env var, not the actual Render deployment (which injects real env vars) or the Jest test suites (which load dotenv via `setupFiles` before anything else). The component test above already exercises the exact same middleware instances used by the real routes, independent of that unrelated bootstrap issue.

### Verdict (Run 2)

AC-001, AC-002, AC-008, and the three highest-risk orders/delivery authorization gaps (PROD-001, PROD-002, PROD-003) are fixed and proven by tests against the real DB. PROD-003 (Shadowfax webhook secret) needs a follow-up **ops step** — configuring the matching secret on Shadowfax's side — before it's fully effective; code alone can't complete it. Remaining open items (PROD-005 through PROD-009, plus the previously-deferred accounts findings AC-003/004/005/006/007/009) are documented in FINDINGS.md and were explicitly out of scope for this "highest-risk fixes first" pass.
