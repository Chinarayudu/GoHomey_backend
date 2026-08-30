# UAT Test Cases — Accounts (Registration, Login, OTP, Profile, Chef Linking, Admin)

**For:** the second/independent tester
**How to use:** work through each case in order within a section (later cases in a section often depend on state from earlier ones). Fill in **Actual Result**, **Pass/Fail**, and **Notes** as you go. If something fails, copy the row into `docs/testing/FINDINGS.md` with a new ID, severity, and repro steps.

## Environment & Test Data Setup

- **Base URL:** ask the team for the environment URL you should test against (local/staging). Do not run destructive cases against production.
- **Test data convention:** use emails ending in `@homey.test` and phone numbers you own (for real OTP/Firebase cases) or a fixed test block agreed with the team. Don't reuse another tester's in-flight test data.
- **Admin account:** you'll need one User row with `role: ADMIN` to test the Admin section. Ask a developer to either promote a test account you register, or share existing admin test credentials — do not use real customer/admin credentials.
- **Reviewer bypass phone (optional):** if `REVIEW_TEST_PHONE`/`REVIEW_TEST_OTP` are configured in the environment, ask the team for the values to test case OTP-05.
- **Admin portal:** `admin_port/` — ask the team for the URL it's deployed to, or run it locally (`npm install && npm run dev` inside `admin_port/`, pointed at your backend's `VITE_API_BASE_URL`).
- **Tools:** Postman/curl/the Swagger UI at `<BASE_URL>/api/v1/docs`, or the actual mobile/web app if available.

---

## 1. Registration

| ID | Title | Preconditions | Test Data | Steps | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| REG-01 | Register with valid data | None | New unique name/email/phone/password | `POST /api/v1/auth/register` with all required fields | HTTP 201; response has `id`, `email`, no `password` field | | | |
| REG-02 | Duplicate email rejected | REG-01 account exists | Same email, different phone | `POST /api/v1/auth/register` | HTTP 409, clear error message | | | |
| REG-03 | Duplicate phone rejected | REG-01 account exists | Same phone, different email | `POST /api/v1/auth/register` | HTTP 409, clear error message | | | |
| REG-04 | Missing required field | None | Omit `password` | `POST /api/v1/auth/register` | HTTP 400 with validation error naming the missing field | | | |
| REG-05 | Invalid email format | None | `email: "not-an-email"` | `POST /api/v1/auth/register` | HTTP 400 | | | |
| REG-06 | Default role is USER | None | Omit `role` field | Register, then check the account's role (via login/profile) | Role is `USER` | | | |
| REG-07 | Extra/unknown field rejected | None | Add an unexpected field, e.g. `isAdmin: true` | `POST /api/v1/auth/register` | HTTP 400 (whitelist validation should reject unknown fields) | | | |

## 2. Email/Password Login

| ID | Title | Preconditions | Test Data | Steps | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| LOGIN-01 | Correct credentials | REG-01 account exists | Correct email+password | `POST /api/v1/auth/login` | HTTP 200, `token` + `user` object returned | | | |
| LOGIN-02 | Wrong password | REG-01 account exists | Correct email, wrong password | `POST /api/v1/auth/login` | HTTP 401, generic "Invalid credentials" (should not reveal whether the email exists) | | | |
| LOGIN-03 | Unknown email | None | Email that was never registered | `POST /api/v1/auth/login` | HTTP 401, same generic message as LOGIN-02 | | | |
| LOGIN-04 | Email case sensitivity | REG-01 account exists (e.g. `qa@homey.test`) | Login with `QA@homey.test` | `POST /api/v1/auth/login` | Note actual behavior — decide with the team whether case-insensitive email matching is expected | | | |

## 3. OTP Login (real phone via MSG91, or bypass if configured)

| ID | Title | Preconditions | Test Data | Steps | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| OTP-01 | Send OTP to a new phone | None | Your real phone number | `POST /api/v1/auth/send-otp` | HTTP 200; SMS arrives within ~30s (unless bypass is on) | | | |
| OTP-02 | Verify with correct OTP — new phone | OTP-01 done | The OTP received | `POST /api/v1/auth/verify-otp` | HTTP 200, `isNewUser: true`, a short-lived token | | | |
| OTP-03 | Verify with wrong OTP | OTP-01 done | An incorrect 6-digit code | `POST /api/v1/auth/verify-otp` | HTTP 400, "Invalid or expired OTP" | | | |
| OTP-04 | Verify after expiry | OTP-01 done | Wait 5+ minutes before verifying | `POST /api/v1/auth/verify-otp` | HTTP 400 (OTP should no longer be valid — Redis TTL is 300s) | | | |
| OTP-05 | Reviewer bypass phone (if configured) | Team has shared `REVIEW_TEST_PHONE`/`REVIEW_TEST_OTP` | Those exact values | Send + verify OTP using the reviewer phone/OTP pair | HTTP 200, works without a real SMS; **a normal/different phone number must NOT be affected by this** | | | |
| OTP-06 | Resend OTP | OTP-01 done | Same phone | Call `send-otp` again before verifying | New OTP overwrites the old one; the old OTP should no longer verify | | | |
| OTP-07 | Existing user OTP login | A User already exists with this phone (e.g. from REG-01, use its phone) | — | Send + verify OTP for that phone | HTTP 200, `isNewUser: false`, full login `token` + `user` | | | |

## 4. Firebase Phone Auth

| ID | Title | Preconditions | Test Data | Steps | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| FB-01 | Valid Firebase ID token | Complete Firebase Phone Auth in the mobile/web client | Resulting `idToken` | `POST /api/v1/auth/verify-firebase-token` | HTTP 200, same response shape as `/verify-otp` | | | |
| FB-02 | Invalid/garbage token | None | Random string as `idToken` | `POST /api/v1/auth/verify-firebase-token` | HTTP 400/401, not a 500 crash | | | |
| FB-03 | Expired token | An old, expired Firebase ID token | — | `POST /api/v1/auth/verify-firebase-token` | HTTP 400/401 | | | |

## 5. Profile — View, Update, and the Password-Change Defect Check

| ID | Title | Preconditions | Test Data | Steps | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| PROF-01 | View own profile | Logged in | — | `GET /api/v1/users/profile` with Bearer token | HTTP 200, full profile incl. `addresses: []` | | | |
| PROF-02 | Update name/dietary preference | Logged in | `name`, `dietary_preference` | `PATCH /api/v1/users/profile` | HTTP 200, fields updated, reflected on next `GET /profile` | | | |
| PROF-03 | **Change password via profile, then log in with the NEW password** | Logged in | New password | `PATCH /api/v1/users/profile` with `{ "password": "<new>" }`, then `POST /api/v1/auth/login` with the new password | **Should succeed (HTTP 200).** If it fails, this confirms a known suspected defect — see FINDINGS.md AC-001 | | | **High priority — this is the case most likely to reproduce the reported "account issues"** |
| PROF-04 | Log in with the OLD password after PROF-03 | PROF-03 done | Old password | `POST /api/v1/auth/login` with the old password | Should fail (HTTP 401) since the password was changed — confirm it fails cleanly, not with a 500 | | | |
| PROF-05 | Update with invalid enum value | Logged in | `dietary_preference: "PIZZA"` | `PATCH /api/v1/users/profile` | HTTP 400 | | | |

## 6. Address Management

| ID | Title | Preconditions | Test Data | Steps | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| ADDR-01 | Add first address, marked default | Logged in | Full address | `POST /api/v1/users/addresses` | HTTP 201, `is_default: true` | | | |
| ADDR-02 | Add second address, also default | ADDR-01 done | Second address, `is_default: true` | `POST /api/v1/users/addresses` | HTTP 201; first address should now show `is_default: false` on `GET /addresses` | | | |
| ADDR-03 | Update an address | ADDR-01 done | New `city`/`zip_code` | `PATCH /api/v1/users/addresses/:id` | HTTP 200, fields updated | | | |
| ADDR-04 | Delete an address | An address exists | — | `DELETE /api/v1/users/addresses/:id` | HTTP 204 | | | |
| ADDR-05 | Delete another user's address | Two accounts, address belongs to account A | Account B's token, account A's address id | `DELETE /api/v1/users/addresses/:id` as account B | Should be rejected (403/404), NOT succeed | | | |

## 7. Location Update

| ID | Title | Preconditions | Test Data | Steps | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| LOC-01 | Update location near a saved address | A saved address with lat/lng exists | Coordinates ~30-50m away | `PATCH /api/v1/users/location` | HTTP 200, `data.matchedAddress` is populated | | | |
| LOC-02 | Update location far from any saved address | — | Coordinates 1km+ away | `PATCH /api/v1/users/location` | HTTP 200, `data.matchedAddress` is `null` | | | |
| LOC-03 | Missing latitude/longitude | Logged in | Omit `longitude` | `PATCH /api/v1/users/location` | HTTP 400 | | | |

## 8. Chef Onboarding (Identity Linking)

| ID | Title | Preconditions | Test Data | Steps | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| CHEF-01 | Complete step 1 | Logged in as a plain USER | Full name/email/mobile/cuisine | `POST /api/v1/chefs/register/step-1` | HTTP 201; `GET /users/profile` now shows `role: CHEF` and a `chef` sub-object | | | |
| CHEF-02 | Complete step 2 | CHEF-01 done | Kitchen details | `POST /api/v1/chefs/register/step-2` | HTTP 200 | | | |
| CHEF-03 | Step 2 before step 1 (new account) | A fresh account, no chef record | Kitchen details | `POST /api/v1/chefs/register/step-2` | HTTP 400, "Complete Step 1 first" | | | |
| CHEF-04 | Complete step 3 (document upload) | CHEF-02 done | 3 files: government_id, food_safety_cert, kitchen_photo | `POST /api/v1/chefs/register/step-3` (multipart) | HTTP 200, `application_status: PENDING_REVIEW` | | | |
| CHEF-05 | OTP login after chef linking | CHEF-01 done | Same phone used at step 1 | Send + verify OTP | HTTP 200, `isChef: true`, `applicationStatus` present | | | |

## 9. Admin — User & Chef Management

| ID | Title | Preconditions | Test Data | Steps | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| ADMIN-01 | Admin login | An account with `role: ADMIN` exists | Admin email+password | `POST /api/v1/auth/login` | HTTP 200, `user.role: ADMIN` | | | |
| ADMIN-02 | `GET /admin/users` returns real data | Logged in as admin | — | `GET /api/v1/admin/users` | HTTP 200, list of real users | | | |
| ADMIN-03 | `GET /users` (non-admin router) — compare | Logged in as admin | — | `GET /api/v1/users` | **Compare with ADMIN-02** — note if this returns a static placeholder message instead of real data (known discrepancy, see FINDINGS.md) | | | |
| ADMIN-04 | Non-admin blocked from admin routes | Logged in as a plain USER | — | `GET /api/v1/admin/users` | HTTP 403 | | | |
| ADMIN-05 | Approve/reject a chef application | A chef with `application_status: PENDING_REVIEW` exists | `{ status: "APPROVED" }` | `PATCH /api/v1/admin/chefs/:id/application` | HTTP 200, status updated; chef's own `GET /chefs/register/status` reflects it | | | |

## 10. Token / Session Edge Cases

| ID | Title | Preconditions | Test Data | Steps | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| TOK-01 | Tampered JWT | Valid token from LOGIN-01 | Flip one character in the token's payload/signature | `GET /api/v1/auth/profile` | HTTP 401 | | | |
| TOK-02 | JWT signed with wrong secret | — | A token signed with a different secret (e.g. via jwt.io) but same payload shape | `GET /api/v1/auth/profile` | HTTP 401 | | | |
| TOK-03 | Old token still works | A token issued days/weeks ago | — | `GET /api/v1/auth/profile` | Currently expected to still work (no expiry is set) — confirm and record; flag as a gap, see FINDINGS.md | | | |
| TOK-04 | No logout endpoint | — | — | Look for a `/auth/logout` or token-revocation endpoint | Confirm none exists — a "compromised device" cannot be revoked server-side today | | | |

## 11. Admin Portal (admin_port/) — End-to-End Through the Real UI

| ID | Title | Preconditions | Test Data | Steps | Expected Result | Actual Result | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|---|
| PORTAL-01 | Log in through the portal UI | Admin account exists, portal running | Admin credentials | Open the portal, log in | Redirects to the dashboard, no console errors | | | |
| PORTAL-02 | Session persists on refresh | PORTAL-01 done | — | Refresh the page | Still logged in | | | |
| PORTAL-03 | 401 triggers redirect to login | PORTAL-01 done | — | Manually corrupt/clear the stored token in browser devtools, then trigger an API call (e.g. navigate to a data page) | Portal detects the 401 and redirects to login rather than showing a broken/blank page | | | |

---

## Summary (fill in after completing all sections)

- Total cases: _____ Pass: _____ Fail: _____ Blocked/Skipped: _____
- New defects filed in FINDINGS.md: _____
- Overall verdict (ready for production / blocked): _____________________
