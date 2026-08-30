# Accounts Sanity Checklist

Fast, manual post-deploy smoke check for the accounts domain — no Jest required. Run this against any environment (local, staging, prod) after a deploy. Target: under 5 minutes.

Replace `BASE_URL` with the environment you're checking, e.g. `http://localhost:3000` or a staging URL.

```bash
export BASE_URL="http://localhost:3000"
```

> Use a throwaway email/phone for these checks — e.g. `sanity.<yourname>.<date>@homey.test` / a phone number you own. Don't reuse a real account's credentials in a shared checklist.

## 1. Health check

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/health"
```
**Expected:** `200`

## 2. Register a new account

```bash
curl -s -X POST "$BASE_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sanity Check","email":"sanity.check@homey.test","phone":"+917000009999","password":"Str0ngPassw0rd!"}'
```
**Expected:** HTTP 201, JSON body with `id`, `email`, no `password` field.

## 3. Log in with the same credentials

```bash
curl -s -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"sanity.check@homey.test","password":"Str0ngPassw0rd!"}'
```
**Expected:** HTTP 200, JSON body with a `token` and `user.email` matching what you registered. **Save the token** for the next step.

## 4. Fetch the authenticated profile

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/auth/profile" \
  -H "Authorization: Bearer <TOKEN_FROM_STEP_3>"
```
**Expected:** `200`

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/auth/profile"
```
**Expected:** `401` (no token)

## 5. Send + verify OTP

> Only works without a real SMS if `OTP_BYPASS_ENABLED=true` is set in that environment, or if you have a real phone to receive the SMS. **Do not leave `OTP_BYPASS_ENABLED=true` set in production** — see FINDINGS.md.

```bash
curl -s -X POST "$BASE_URL/api/v1/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+917000009998"}'
```
**Expected:** HTTP 200, `{"message":"OTP sent successfully"}`

```bash
curl -s -X POST "$BASE_URL/api/v1/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+917000009998","otp":"<OTP_FROM_SMS_OR_BYPASS>"}'
```
**Expected:** HTTP 200, `isNewUser: true`, a `token` present.

## 6. Confirm role-gating on an admin route

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/v1/users" \
  -H "Authorization: Bearer <TOKEN_FROM_STEP_3>"
```
**Expected:** `403` (the account from step 2 is a plain USER, not ADMIN)

## Automated equivalent

The same checks (plus a few more) run automatically via:

```bash
npm run test:sanity
```

against your local Postgres/Redis — see `docs/testing/TEST_PLAN.md` for setup.

## After running this checklist

Delete the throwaway account you created in step 2 (via `npm run db:wipe:confirm` **only if you're certain the target DB is a QA/dev DB, never staging or prod with real data** — otherwise remove it manually), or simply leave it if the environment already has its own QA-data cleanup convention.
