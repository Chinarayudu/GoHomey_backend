# Accounts, Payments, Orders & Delivery — Findings / Defects Log

Each finding includes evidence (file:line or a specific test) so it can be independently verified. "Status" starts as `Open` — update it as the team triages.

**2026-08-15 update:** following a broader production-readiness survey of `payments/`, `orders/`, and `delivery/` (see PROD-001 onward below), three of the accounts findings (AC-001, AC-002, AC-008) and the three highest-risk authorization/security gaps found in orders/delivery (PROD-001, PROD-002, PROD-003) were fixed and are now proven by tests, per an explicit "highest-risk fixes first" scoping decision. Everything else below remains open/deferred by design — see each finding's Status line.

---

## AC-001 — `PATCH /users/profile` stores a new password in plaintext (breaks login)

- **Severity:** Critical
- **Area:** Users / Profile
- **Evidence:**
  - `src/users/users.service.ts:202-212` (`update()`) passes `data` straight to `prisma.user.update()` with no hashing step.
  - Contrast with `src/users/users.service.ts:177-200` (`create()`), which does `bcrypt.hash(data.password, 10)` before saving.
  - Component test: `src/users/users.service.spec.ts` — `test.failing('hashes a newly supplied password before persisting it ...')` — currently reports as **passed** because its assertions fail, i.e. the bug is confirmed. Once fixed, flip this to a normal `test()`.
  - Integration test: `src/users/users.router.integration.spec.ts` — `'DEFECT: changing password via PATCH /users/profile breaks login for both the old and new password'` — end-to-end proof against the real DB.
- **Repro steps:**
  1. Register a user, log in.
  2. `PATCH /api/v1/users/profile` with `{ "password": "NewPassword123!" }` — succeeds with HTTP 200.
  3. `POST /api/v1/auth/login` with the new password.
  4. **Confirmed against the real DB (2026-08-15, local integration run):** login with the *new* password returns **HTTP 401** ("Invalid credentials") — `bcrypt.compare()` against the now-plaintext "hash" resolves `false` rather than throwing, so it fails cleanly (not a 500).
  5. Also tried logging in with the *old* password — **also HTTP 401**, since it was overwritten.
- **Impact:** Any user who changes their password via `PATCH /users/profile` is **locked out of email/password login entirely**, with no server error to indicate why (both attempts look like an ordinary "wrong password" to the client). This directly matches the reported "issues with accounts."
- **Fix applied (2026-08-15):** `UsersService.update()` now hashes `data.password` with `bcrypt.hash(data.password, 10)` before calling `prisma.user.update()`, mirroring `create()`. Requiring the *current* password to authorize a change was intentionally **not** added — that's an API-contract change needing frontend/mobile coordination, tracked separately.
- **Proof:** `src/users/users.service.spec.ts` (`UsersService.update — password handling`, now a normal passing `test()`, no longer `test.failing`) and `src/users/users.router.integration.spec.ts` (`'changing password via PATCH /users/profile lets you log in with the new password, not the old one'`) — both green against the real DB.
- **Status:** Fixed

---

## AC-002 — `GET /api/v1/users` is a dead stub; `GET /api/v1/admin/users` is the real "list users" endpoint

- **Severity:** Medium
- **Area:** Users / Admin
- **Evidence:** `src/users/users.router.ts:137-140` — `usersRouter.get('/', jwtAuth, checkRoles(Role.ADMIN), (req, res) => { res.json({ message: 'Admin: list all users' }); })` never queries the database. The real implementation is `src/admin/admin.router.ts:476-483` → `adminService.getAllUsers()`.
- **Repro steps:** Log in as an admin, call `GET /api/v1/users` vs `GET /api/v1/admin/users` — the former returns a static placeholder message, the latter returns real user data.
- **Impact:** Confusing duplicate API surface. If any client (admin portal or otherwise) is pointed at `/api/v1/users` instead of `/api/v1/admin/users`, it will silently get a placeholder instead of real data.
- **Fix applied (2026-08-15):** `GET /api/v1/users` now calls `adminService.getAllUsers()` (same source of truth as `/admin/users`) instead of returning a static message.
- **Status:** Fixed

---

## AC-003 — No password-reset / forgot-password flow exists

- **Severity:** Medium
- **Area:** Auth
- **Evidence:** No route, service method, or DTO anywhere in `src/` mentions "reset," "forgot," or a password-reset token. The only way to change a password today is `PATCH /users/profile` while already authenticated (see AC-001).
- **Impact:** A user who forgets their password and doesn't have OTP/Firebase phone auth linked has no self-service recovery path.
- **Suggested fix (not applied):** add a standard forgot-password flow (email or SMS reset token + expiry), independent of AC-001's fix.
- **Status:** Open

---

## AC-004 — JWTs never expire; no logout/revocation mechanism

- **Severity:** Medium
- **Area:** Auth / Security
- **Evidence:** `src/auth/auth.service.ts` `login()` — `jwt.sign(payload, this.jwtSecret)` with no `expiresIn` option (contrast with the temporary registration token in `resolveIdentity()`, which does set `{ expiresIn: '1h' }`). Component test `src/auth/auth.service.spec.ts` — `'signs a JWT with no expiry'` confirms `decoded.exp` is `undefined`. No session/token table exists to support server-side revocation (confirmed via schema review — no Session/RefreshToken model in `prisma/schema.prisma`).
- **Impact:** A leaked/stolen token remains valid forever; there's no way to force a logout (e.g., after a password change, a reported device theft, or an admin-initiated account lock).
- **Suggested fix (not applied):** set a reasonable `expiresIn` (e.g. 7-30 days) plus a refresh-token flow, or maintain a minimal revocation list in Redis.
- **Status:** Open

---

## AC-005 — `OTP_BYPASS_ENABLED` / `REVIEW_TEST_PHONE` must be verified OFF in production

- **Severity:** High (config risk, not a code bug)
- **Area:** Auth / Config
- **Evidence:** `src/auth/auth.service.ts:80-90, 157-161` — when `OTP_BYPASS_ENABLED=true`, `verifyOtp()` accepts **any** OTP for **any** phone. `.env.example` explicitly warns "DO NOT leave true once real users can reach this API." Recent commit `07afa12` ("Add temporary OTP_BYPASS_ENABLED flag for testing before DLT approval") confirms this was intentionally added as a temporary measure.
- **Impact:** If left on in a reachable production environment, anyone can log in as any phone number without proof of ownership — a full authentication bypass.
- **Action needed (not a code change):** confirm with the team that `OTP_BYPASS_ENABLED` is unset/`false` in the real production `.env`, and add this to the pre-launch checklist. Same applies to `REVIEW_TEST_PHONE`/`REVIEW_TEST_OTP` — low risk since it's phone-scoped, but confirm the configured phone number isn't guessable/public.
- **Status:** Open — needs a config confirmation, not a code fix.

---

## AC-006 — Twilio env vars declared but never used in application code

- **Severity:** Low
- **Area:** Config / Documentation
- **Evidence:** `render.yaml` declares `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, but a repo-wide search shows Twilio is only referenced in `scratch/verify_twilio.ts` (a standalone credential-check script never wired into the app). The actual OTP providers are **MSG91** and **Firebase Phone Auth** only (`src/auth/auth.service.ts`, `src/common/services/firebase.service.ts`).
- **Impact:** Deploy-config and documentation drift; wastes a reviewer's time investigating a provider that isn't actually integrated.
- **Suggested fix (not applied):** remove the unused Twilio env vars from `render.yaml`, or wire them up if Twilio is genuinely planned as a fallback provider.
- **Status:** Open

---

## AC-007 — `resolveIdentity()` User↔Chef linking has no transaction across its multi-step read/write sequence

- **Severity:** Medium
- **Area:** Auth / Data integrity
- **Evidence:** `src/auth/auth.service.ts:191-298` (`resolveIdentity`) performs several sequential `findUnique`/`findFirst`/`update`/`create` calls without wrapping them in a Prisma transaction (`prisma.$transaction`).
- **Impact:** Under concurrent OTP verifications for the same phone (e.g. a double-tap on "verify" from a flaky mobile network causing a retry), it's possible for two requests to both observe "no chef linked yet" and both attempt to create/link records, risking a duplicate-key error or an inconsistent partial link. Not confirmed with a live concurrency test in this pass — flagged for follow-up.
- **Suggested fix (not applied):** wrap the check-then-write sequence in `prisma.$transaction(...)`, or add idempotency handling for duplicate concurrent verifications.
- **Status:** Open — needs a dedicated concurrency test to confirm severity.

---

## AC-008 — Deleting/updating another user's address may return 500 instead of 403/404

- **Severity:** Low/Medium
- **Area:** Users / Addresses
- **Evidence:** `src/users/users.service.ts` `removeAddress()`/`updateAddress()` call `prisma.address.delete({ where: { id: addressId, user_id: userId } })` / `.update(...)`. Prisma throws a `P2025` "record not found" error (not a custom `{status}` error) when the id+user_id combination doesn't match, which the global error handler (`src/app.ts` — `err.status || 500`) turns into an HTTP 500 rather than a clean 403/404.
- **Repro steps:** See `src/users/users.router.integration.spec.ts` — `"does not allow deleting another user's address"`. **Confirmed against the real DB (2026-08-15):** the cross-user delete attempt returns **HTTP 500** with a raw Prisma error message in the response body, and the address is correctly left intact for its real owner.
- **Impact:** Cross-user address access is still blocked (no data leak), but the error response is a confusing 500 instead of a clean 403/404, which could look like a server bug to API consumers/monitoring.
- **Fix applied (2026-08-15):** `removeAddress()`/`updateAddress()` now catch Prisma's `P2025` and re-throw as a `404`.
- **Proof:** `src/users/users.router.integration.spec.ts` (`"does not allow deleting another user's address"`) now asserts `404` against the real DB.
- **Status:** Fixed

---

## AC-009 — API documentation drift

- **Severity:** Low
- **Area:** Documentation
- **Evidence:** `API_DOCUMENTATION.md` documents `/auth/register` with `firstName`/`lastName` fields and an `access_token` response field; the real `RegisterDto` (`src/auth/dto/auth.dto.ts`) uses a single `name` field, and the real login response shape (`src/auth/auth.service.ts` `login()`) is `{ token, user }`. Root `README.md` is unmodified NestJS boilerplate (`npm run test:e2e` etc.) that doesn't match this project's actual Express-based scripts.
- **Impact:** Low direct risk, but wastes onboarding/integration time for anyone (including the second tester) who trusts the `.md` docs over the router source/Swagger.
- **Suggested fix (not applied):** regenerate/correct `API_DOCUMENTATION.md` and `README.md`, or point readers to `<BASE_URL>/api/v1/docs` (Swagger, generated from the router JSDoc, which is accurate) as the source of truth.
- **Status:** Open

---

---

## PROD-001 — `PATCH /orders/:id/status` had no ownership check (fixed)

- **Severity:** Critical
- **Area:** Orders / Authorization
- **Evidence:** `src/orders/orders.router.ts` — any `CHEF`-role token could update *any* order's status, including to `DELIVERED`, which triggers `paymentsService.releaseChefPayoutForOrder()` (`src/orders/orders.service.ts`). No check that the calling chef actually owns the order.
- **Impact:** Any chef account could move a competitor's order to `DELIVERED` and trigger that order's payout release — a direct financial/fraud risk.
- **Fix applied (2026-08-15):** the router now resolves the caller's own chef record when `role === CHEF` and passes its id into `updateOrderStatus(id, status, requestingChefId?)`, which throws `403` if the order's `chef_id` doesn't match. `ADMIN` callers are unaffected (no ownership check applied).
- **Related fix:** while adding this, discovered `updateOrderStatus()` awaited `ordersQueue.add(...)` (BullMQ notification) unguarded — if Redis is unreachable, ioredis/BullMQ queue the command indefinitely rather than rejecting, which would hang the entire status-update response (this is exactly what happened to the new integration test until fixed). Changed to fire-and-forget with a `.catch()`, matching the existing try/catch pattern already used for the payout-release call two lines above it in the same function.
- **Proof:** `src/orders/orders.router.integration.spec.ts` — chef A gets 403 on chef B's order; chef succeeds on their own order; admin succeeds on any order. All green against the real DB.
- **Status:** Fixed

## PROD-002 — `PATCH /delivery/:id/status` had no role check at all (fixed)

- **Severity:** High
- **Area:** Delivery / Authorization
- **Evidence:** `src/delivery/delivery.router.ts` — every other mutating route in this file is `checkRoles(Role.ADMIN)`; this one had only `jwtAuth`, so any authenticated USER or CHEF could update any delivery's status, including to `DELIVERED` (which cascades to the linked `Order` and triggers chef payout release — `delivery.service.ts` `updateDeliveryStatus()`).
- **Fix applied (2026-08-15):** added `checkRoles(Role.ADMIN)`, consistent with the rest of the router. If chefs or delivery partners genuinely need self-service status updates in the future, that should be a deliberate, separately-scoped addition (not restored implicitly).
- **Proof:** `src/delivery/delivery.router.integration.spec.ts` — USER and CHEF tokens get 403; ADMIN gets through. Green against the real DB.
- **Status:** Fixed

## PROD-003 — Shadowfax webhook had zero signature/secret verification (partially fixed — needs Shadowfax-side config too)

- **Severity:** High
- **Area:** Delivery / Webhooks / Security
- **Evidence:** `src/delivery/webhooks.router.ts` `/shadowfax` — accepted any POST/PUT with zero authentication, matched a `Delivery` by `order_id`/`external_tracking_id` extracted from the body by shape, and updated status accordingly. Unlike the legacy Borzo webhook (opt-in HMAC via `BORZO_WEBHOOK_SECRET`), there was no equivalent secret for Shadowfax at all.
- **Fix applied (2026-08-15):** added an opt-in shared-secret check (`SHADOWFAX_WEBHOOK_SECRET` env var + `x-shadowfax-webhook-secret` header, `crypto.timingSafeEqual`), same pattern as Borzo — enforced only once the env var is set, so existing sandbox testing isn't broken until configured.
- **Important — this fix is incomplete without an ops step:** setting `SHADOWFAX_WEBHOOK_SECRET` in `.env` only protects our side. **Someone needs to configure the identical secret value as a custom header in Shadowfax's own webhook/dashboard settings** — verify with Shadowfax support/docs whether they support custom headers on outbound webhooks at all; if not, an alternative (e.g. a secret token embedded in the webhook URL path) will be needed instead.
- **Proof:** `src/delivery/webhooks.router.spec.ts` — rejects 401 with no/wrong header when the secret is configured; accepts when correct; still works with no secret configured (back-compat).
- **Status:** Fixed in code; **Open** pending the Shadowfax-side configuration step above.

## PROD-004 — Auth and webhook endpoints were completely unthrottled (fixed)

- **Severity:** Medium
- **Area:** Auth / Webhooks / Availability
- **Evidence:** No rate-limiting middleware existed anywhere in `src/common/middleware/`; `/auth/login`, `/auth/register`, `/auth/send-otp`, `/auth/verify-otp`, and all webhook endpoints accepted unlimited requests, enabling brute-force login/OTP-spam and basic DoS against webhook handlers.
- **Fix applied (2026-08-15):** added `express-rate-limit` (new dependency) via `src/common/middleware/rateLimit.middleware.ts` — a strict limiter (10 req/min/IP) on the four auth routes above, and a moderate limiter (60 req/min/IP) on `/payments/webhook/razorpay`, `/webhooks/shadowfax`, `/webhooks/borzo`. Uses the default in-memory store — **a multi-instance deployment needs a shared store (e.g. Redis) for this to be enforced consistently across instances**, currently out of scope.
- **Proof:** `src/common/middleware/rateLimit.middleware.spec.ts` — 429 after the limit, resets after the window, skipped when `OTP_BYPASS_ENABLED=true` (reused as the existing "not reachable by real users" test-mode signal).
- **Status:** Fixed (single-instance); shared-store follow-up needed if/when this runs multi-instance.

## PROD-005 — `POST /payments/verify` has no order-ownership check

- **Severity:** Medium
- **Area:** Payments / Authorization
- **Evidence:** `src/payments/payments.router.ts` — this route has no `jwtAuth` at all (likely intentional, matching the standard Razorpay checkout-redirect flow which may run before a fresh session exists), and nothing checks that the caller is the order's actual owner — only that the HMAC signature is valid for the given `razorpay_order_id`/`payment_id` triple.
- **Impact:** Low on its own (the signature does bind to Razorpay's secret, so an attacker would need a legitimate signature triple, which they'd typically only have if they were a party to that specific checkout), but worth a deliberate decision rather than an implicit gap.
- **Status:** Open — not fixed this pass (deferred per "highest-risk fixes first" scoping; this is a real gap but lower severity than PROD-001/002/003).

## PROD-006 — No webhook idempotency ledger for Razorpay events

- **Severity:** Medium
- **Area:** Payments / Data integrity
- **Evidence:** `src/payments/payments.service.ts` `handleWebhook()` re-derives state from each event with no persisted "processed event IDs" table. Practically semi-idempotent by side-effect design (fuel-subscription creation skips already-linked items; payment/order updates are idempotent no-ops on replay), but there's no protection against **out-of-order** delivery — e.g. a delayed `payment.failed` arriving after `payment.captured` would flip a COMPLETED payment back to FAILED.
- **Status:** Open — needs a dedicated idempotency-ledger design + tests, out of scope for this pass.

## PROD-007 — Chef payout release has no actual bank-transfer integration

- **Severity:** Medium (product gap, not a bug)
- **Area:** Payments / Chef Payouts
- **Evidence:** `releaseChefPayoutForOrder()` (`src/payments/payments.service.ts`) only creates an internal `ChefPayout` record and flips `escrow_status` to `RELEASED` — there's no integration with a payout/transfer API. Money is marked "released" internally but nothing actually sends it to the chef's bank/UPI account.
- **Status:** Open — this is a product/infra gap, not something to silently code around; needs a deliberate decision on the payout rail (manual, RazorpayX, etc.).

## PROD-008 — Orders have no status state-machine validation

- **Severity:** Medium
- **Area:** Orders / Data integrity
- **Evidence:** `UpdateOrderStatusDto` only validates the new status is one of 8 enum values (`@IsIn`) — `updateOrderStatus()` allows any transition from any current status (e.g. `PENDING` → `DELIVERED` directly, skipping `CONFIRMED`/`PREPARING`/`OUT_FOR_DELIVERY`), which would trigger payout release without the order having gone through its normal lifecycle.
- **Status:** Open — needs an explicit allowed-transitions map, out of scope for this pass (the ownership check in PROD-001 at least ensures only the *right* chef can do this).

## PROD-009 — Shadowfax sandbox methods have no runtime mode guard

- **Severity:** Low/Medium → **now more relevant**: this environment's local `.env` was switched to real production Shadowfax credentials on 2026-08-15 (`SHADOWFAX_API_MODE=production`, a real production `SHADOWFAX_API_TOKEN`, `SHADOWFAX_BASE_URL` override cleared so it resolves to the live API). Previously this finding was theoretical; now a stray call to a sandbox-simulation method or to `createOrder()`/`cancelOrder()` during local development genuinely hits Shadowfax's live production API.
- **Area:** Delivery / Shadowfax integration
- **Evidence:** `src/delivery/shadowfax.client.ts` sandbox-only methods (`allotSandboxRider`, `collectSandboxOrder`, `deliverSandboxOrder`, etc., targeting `/app/v3/sandbox/...` paths) exist alongside production methods with no confirmed runtime guard preventing them from being invoked when `SHADOWFAX_API_MODE=production`. Call sites in `delivery.service.ts` weren't traced far enough in this pass to confirm whether they're actually gated — the sandbox admin route (`POST /admin/deliveries/:id/shadowfax-sandbox-status`) exists in `admin.router.ts` and would now route to the *production* host with these credentials.
- **Also note:** `.env` has a `SHADOWFOX_MOCK = true` line (misspelled — should be `SHADOWFAX_MOCK`, also non-standard `KEY = value` spacing) that isn't referenced anywhere in `src/` under either spelling. It provides zero actual protection against real API calls — don't rely on it as a safety net.
- **Suggested fix (not applied):** add an explicit guard in `delivery.service.ts` (or the sandbox admin route) refusing sandbox-simulation calls when `resolveShadowfaxApiMode() === 'production'`.
- **Status:** Open — needs verification of call sites and a real guard; recommend prioritizing this now that production credentials are live in this environment.

## PROD-010 — Local dev server crashes on a clean `npm run start:dev` unless `JWT_SECRET` is a real OS env var (not just in `.env`)

- **Severity:** Low (local-dev-only; does not affect the Render deployment, which injects real env vars directly)
- **Area:** Bootstrap / Config
- **Evidence:** `src/index.ts` imports `app` (which transitively imports `src/common/middleware/auth.middleware.ts` → `src/config/env.ts`) *before* calling `dotenv.config()` on the line after those imports. `config/env.ts` reads `process.env.JWT_SECRET` directly with no `dotenv/config` import of its own, unlike `prisma.service.ts`/`redis.client.ts` which self-load dotenv. If `JWT_SECRET` isn't already present as a real environment variable when the process starts, `npm run start:dev` crashes immediately with `Error: JWT_SECRET is not defined`, even with a valid `.env` file present.
- **Repro:** discovered while smoke-testing the new rate limiter against a live server in a shell with no pre-set `JWT_SECRET` env var (only `.env`).
- **Suggested fix (not applied):** add `import 'dotenv/config';` as the very first line of `src/index.ts` (or of `src/config/env.ts` itself), before any other import.
- **Status:** Open — not fixed this pass (unrelated to the authorized scope; low severity since it doesn't affect the actual deployment).

---

## Template for new findings (copy this for anything found during UAT)

```
## AC-0XX — <short title>

- **Severity:** Critical / High / Medium / Low
- **Area:** <domain area>
- **Evidence:** <file:line, test name, or exact repro>
- **Repro steps:** <numbered steps>
- **Impact:** <who/what is affected>
- **Suggested fix (not applied):** <optional>
- **Status:** Open
```
