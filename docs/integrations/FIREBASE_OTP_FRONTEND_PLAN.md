# Firebase Phone Auth — Frontend (React Native) Implementation Plan

**Audience:** mobile app team (React Native)
**Why:** move OTP verification off MSG91 (blocked on DLT template approval) onto Firebase Phone Auth, which doesn't require DLT registration since Google handles SMS delivery under its own registration.
**Backend status:** `POST /auth/verify-firebase-token` already exists and is fully wired to the same identity-resolution logic as the current OTP flow — see §2. **Update 2026-08-15: Firebase Admin credentials are now configured and verified working** (project `gohomeyy-ced8f`) — the endpoint is live and ready for real ID tokens today.

**For the detailed, code-level RN implementation** (hooks, screens, error-code reference, testing checklist), see `docs/integrations/FIREBASE_OTP_REACT_NATIVE_IMPLEMENTATION.md`. This doc covers the Console setup checklist and rollout strategy; that one covers how to actually build it.

---

## 1. What backend needs from Firebase (Console setup — do this first)

Whoever owns/creates the Firebase project needs to do the following. Some of it needs mobile-team input (App Store/Play Console access), so this is a shared checklist, not purely a backend task:

| Step | Who | Detail |
|---|---|---|
| Create or reuse a Firebase project | Whoever has Firebase org access | One project, shared by backend + app |
| Enable **Phone** as a sign-in provider | Same | Firebase Console → Authentication → Sign-in method → Phone |
| Generate a service account key | Same → hand to backend | Project Settings → Service Accounts → Generate new private key → gives `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (paste into backend `.env`, private key needs its `\n` literal-escaped) |
| Add test phone numbers | Same | Authentication → Sign-in method → Phone → "Phone numbers for testing" — lets QA/app-store review sign in with a fixed number + fixed code, no real SMS sent. This replaces `REVIEW_TEST_PHONE`/`REVIEW_TEST_OTP` for the Firebase path. |
| Add Android SHA-1 + SHA-256 fingerprints | **Mobile team** | Project Settings → Your apps → Android app → Add fingerprint. Needed for both debug and release keystores, or phone auto-verification (SMS Retriever) and Play Integrity checks will fail. |
| Upload an APNs Auth Key | **Mobile team** | Project Settings → Cloud Messaging (or Authentication → Sign-in method → Phone → APNs section). Needed for iOS silent-push verification during phone auth — without it, iOS falls back to reCAPTCHA, which is a much worse UX in-app. |
| Download `google-services.json` (Android) / `GoogleService-Info.plist` (iOS) | **Mobile team** | From Project Settings → Your apps, once the Android/iOS apps are registered in the Firebase project |

**Once the service account key exists, hand `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` to backend** — those three env vars are all that's needed to make `/auth/verify-firebase-token` functional. Nothing else on the backend needs to change.

---

## 2. Backend contract (already implemented — this is what the app calls)

**No backend call is needed to "send" an OTP anymore.** Sending happens entirely client-side via the Firebase SDK (§3). The app only calls the backend once, after Firebase itself has confirmed the code:

```
POST /api/v1/auth/verify-firebase-token
Content-Type: application/json

{ "idToken": "<the ID token from Firebase after successful phone verification>" }
```

**Response — identical shape to the existing `/auth/verify-otp` response**, so the app's existing branching logic for that response can be reused as-is:

New phone (no account yet):
```json
{
  "isNewUser": true,
  "phone": "+919876543210",
  "token": "<short-lived, 1h registration token>",
  "message": "OTP verified successfully. Please complete your registration."
}
```

Existing user/chef:
```json
{
  "isNewUser": false,
  "isChef": true,
  "registrationStep": 3,
  "applicationStatus": "APPROVED",
  "redirectToStatus": true,
  "token": "<full login JWT>",
  "user": { "id": "...", "name": "...", "email": "...", "role": "CHEF", "latitude": null, "longitude": null },
  "phone": "+919876543210"
}
```

Error cases to handle:
- `400` — invalid/expired/garbage ID token, or the token wasn't issued for phone sign-in
- `500` — backend Firebase isn't configured yet (shouldn't happen once §1 is done; if you see this in production, it means the backend env vars are missing/wrong)

---

## 3. React Native implementation steps

**Recommended library: `@react-native-firebase/auth`** (+ `@react-native-firebase/app`), not the plain Firebase JS SDK. The RN Firebase module wraps the native iOS/Android SDKs, which support silent APNs push / SMS auto-retrieval verification — the JS SDK would force a reCAPTCHA challenge even inside the native app, which is a noticeably worse UX.

### 3.1 Install & configure
```bash
npm install @react-native-firebase/app @react-native-firebase/auth
```
- **Android:** drop `google-services.json` into `android/app/`, apply the Google Services Gradle plugin (per `@react-native-firebase/app` install docs), rebuild.
- **iOS:** drop `GoogleService-Info.plist` into the Xcode project, `cd ios && pod install`, enable **Push Notifications** + **Background Modes → Remote notifications** capabilities in Xcode (required for silent-push phone auth verification).

### 3.2 Send the OTP (client-side, no backend call)
```ts
import auth from '@react-native-firebase/auth';

const confirmation = await auth().signInWithPhoneNumber(phoneNumber); // e.g. "+919876543210"
// store `confirmation` in component state — you'll need it to confirm the code
```
This is the entire "send OTP" step. Firebase handles SMS delivery, and on Android often auto-detects the code via the SMS Retriever API without the user typing anything.

### 3.3 Verify the OTP (client-side)
```ts
const userCredential = await confirmation.confirm(otpCode);
const idToken = await userCredential.user.getIdToken();
```

### 3.4 Call the backend with the ID token
```ts
const response = await fetch(`${API_BASE_URL}/auth/verify-firebase-token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken }),
});
const data = await response.json();
// data has the exact same shape as the current /verify-otp response —
// reuse the existing isNewUser / isChef / token handling as-is.
```

### 3.5 Error handling
Map both layers of errors to user-facing messages:

**Firebase SDK errors** (thrown by `signInWithPhoneNumber`/`confirm`), by `error.code`:
- `auth/invalid-phone-number` — bad format, validate before sending
- `auth/too-many-requests` / `auth/quota-exceeded` — Firebase's own rate limiting kicked in; show "try again later"
- `auth/invalid-verification-code` — wrong code entered
- `auth/session-expired` / `auth/code-expired` — code timed out, prompt to resend

**Backend errors** — `400` (invalid/expired token — shouldn't normally happen since Firebase itself already validated the code before issuing the token, but handle it as "please try again"), and `429` if the app is hammering the endpoint (rate-limited server-side, 10 req/min/IP — shouldn't occur in normal single-user flows).

### 3.6 Testing
Use the Firebase Console test phone numbers from §1 — sign in with the configured test number + fixed code and no real SMS is sent, no cost, works in CI/emulators and for app-store reviewers.

---

## 4. Rollout recommendation

Don't hard-cut over in one release. Recommend:
1. Ship the Firebase flow behind a feature flag (remote config or a simple app-version gate), with the existing `/auth/send-otp` + `/auth/verify-otp` (MSG91) flow left in the codebase as a fallback.
2. Roll out to a small percentage of users / internal testers first, watch for the device-failure-mode issues noted in the earlier discussion (rooted devices, no Google Play Services, corporate MDM devices).
3. Only remove the MSG91 client-side flow once Firebase has proven reliable in production for a while — the backend will keep both endpoints working regardless, so there's no backend pressure to rush the cutover.

## 5. Summary — who does what

| Task | Owner |
|---|---|
| Firebase project + Phone provider + service account key + test numbers | Firebase project owner |
| Android SHA fingerprints, iOS APNs key, `google-services.json`/`GoogleService-Info.plist` | Mobile team |
| RN SDK integration, phone auth UI flow, error handling, feature-flagged rollout | Mobile team (this doc, §3–4) |
| Wire `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` into backend `.env`, verify `/auth/verify-firebase-token` end-to-end, add automated test coverage for it | Backend (ready to go as soon as credentials exist) |
