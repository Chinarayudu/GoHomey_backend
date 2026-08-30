# Firebase Phone Auth — Detailed React Native Implementation Guide

**Status:** Backend is live and verified — Firebase Admin credentials are configured and confirmed working (`FIREBASE_PROJECT_ID=gohomeyy-ced8f`). `POST /auth/verify-firebase-token` is ready to receive real ID tokens today.
**Companion doc:** `docs/integrations/FIREBASE_OTP_FRONTEND_PLAN.md` covers the Firebase Console checklist (who sets up what) and the rollout strategy. This doc is the deep implementation reference for the RN team specifically.

---

## 1. Prerequisites checklist (confirm before writing code)

- [ ] Phone sign-in provider enabled in Firebase Console (Authentication → Sign-in method)
- [ ] Android app registered in the Firebase project, `google-services.json` downloaded
- [ ] iOS app registered in the Firebase project, `GoogleService-Info.plist` downloaded
- [ ] Android SHA-1 **and** SHA-256 fingerprints added for both debug and release keystores (Project Settings → Your apps → Android app → Add fingerprint) — get these via `cd android && ./gradlew signingReport`
- [ ] APNs Auth Key uploaded to Firebase (Project Settings → Cloud Messaging, or Authentication → Sign-in method → Phone → APNs section)
- [ ] At least one test phone number configured (Authentication → Sign-in method → Phone → Phone numbers for testing) so you can develop without burning real SMS

If any of these are missing, phone auth will either fail outright or silently fall back to a reCAPTCHA challenge (bad UX, and on some devices won't work at all). Don't start the code below until this list is done.

---

## 2. Install packages

```bash
npm install @react-native-firebase/app @react-native-firebase/auth
# iOS only:
cd ios && pod install
```

Use `@react-native-firebase/auth`, **not** the plain `firebase` JS SDK. The RN Firebase module wraps the native iOS/Android SDKs, which support silent APNs push (iOS) and SMS Retriever auto-verification (Android) — the JS SDK forces a reCAPTCHA webview challenge on every attempt, which is a materially worse in-app experience and a common source of "why did phone auth fail" bug reports.

---

## 3. Platform setup

### Android
1. Place `google-services.json` in `android/app/`.
2. In `android/build.gradle`, add the Google Services classpath (root-level `dependencies`):
   ```groovy
   classpath 'com.google.gms:google-services:4.4.2'
   ```
3. In `android/app/build.gradle`, apply the plugin at the bottom:
   ```groovy
   apply plugin: 'com.google.gms.google-services'
   ```
4. Rebuild (`npx react-native run-android` or a clean gradle build). If you skip the SHA fingerprint step in §1, auto-verification via SMS Retriever silently fails and every user has to manually type the OTP — not a hard failure, but worth getting right.

### iOS
1. Place `GoogleService-Info.plist` in the Xcode project (drag into the project navigator, ensure "Copy items if needed" is checked).
2. In Xcode → target → Signing & Capabilities: add **Push Notifications** and **Background Modes → Remote notifications**. Phone auth on iOS uses a silent push to verify the app isn't a bot; without this capability it falls back to reCAPTCHA in a webview.
3. In `AppDelegate`, no extra code is typically needed if `@react-native-firebase/app` is linked correctly — it registers for remote notifications automatically. If you see phone auth always falling back to reCAPTCHA on iOS, this capability is the first thing to check.
4. **iOS Simulator note:** silent-push verification doesn't work on the simulator (no real APNs delivery). Use the Firebase test phone numbers (§1) for simulator development, and test real numbers only on a physical device.

---

## 4. Core implementation

### 4.1 Phone number normalization

Always send E.164 format (`+<countrycode><number>`, e.g. `+919876543210`) to Firebase — this must match what the backend expects too (the backend's `RegisterDto`/OTP DTOs just treat phone as a plain string, but consistency matters for the User/Chef lookup-by-phone logic on the backend, which does exact string matches).

```ts
// utils/phone.ts
export function toE164(rawInput: string, defaultCountryCode = '+91'): string {
  const digits = rawInput.replace(/\D/g, '');
  if (rawInput.trim().startsWith('+')) return `+${digits}`;
  return `${defaultCountryCode}${digits}`;
}
```

### 4.2 The `useFirebasePhoneAuth` hook

This encapsulates the whole flow — sending, confirming, resend cooldown, and the backend call — so screens stay thin.

```ts
// hooks/useFirebasePhoneAuth.ts
import { useCallback, useRef, useState } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

const API_BASE_URL = process.env.API_BASE_URL; // e.g. https://api.gohomey.com/api/v1
const RESEND_COOLDOWN_SECONDS = 30;

export type PhoneAuthStage = 'idle' | 'sending' | 'awaiting-code' | 'confirming' | 'done';

export interface BackendAuthResult {
  isNewUser: boolean;
  isChef?: boolean;
  registrationStep?: number | null;
  applicationStatus?: string | null;
  redirectToStatus?: boolean;
  token: string;
  phone: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    latitude: number | null;
    longitude: number | null;
  };
  message?: string;
}

export function useFirebasePhoneAuth() {
  const [stage, setStage] = useState<PhoneAuthStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const confirmationRef = useRef<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const sendCode = useCallback(async (e164Phone: string) => {
    setError(null);
    setStage('sending');
    try {
      confirmationRef.current = await auth().signInWithPhoneNumber(e164Phone);
      setStage('awaiting-code');
      startCooldown();
    } catch (err: any) {
      setStage('idle');
      setError(mapFirebaseError(err));
      throw err;
    }
  }, [startCooldown]);

  const resendCode = useCallback(async (e164Phone: string) => {
    if (resendCooldown > 0) return; // guard: cooldown not elapsed
    await sendCode(e164Phone);
  }, [resendCooldown, sendCode]);

  const confirmCode = useCallback(async (code: string): Promise<BackendAuthResult> => {
    if (!confirmationRef.current) {
      throw new Error('No verification in progress — call sendCode first.');
    }
    setError(null);
    setStage('confirming');
    try {
      const userCredential = await confirmationRef.current.confirm(code);
      const idToken = await userCredential!.user.getIdToken();

      const response = await fetch(`${API_BASE_URL}/auth/verify-firebase-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Verification failed (${response.status})`);
      }

      const result: BackendAuthResult = await response.json();
      setStage('done');
      return result;
    } catch (err: any) {
      setStage('awaiting-code'); // let the user retry the code without resending
      setError(mapFirebaseError(err));
      throw err;
    }
  }, []);

  const reset = useCallback(() => {
    confirmationRef.current = null;
    setStage('idle');
    setError(null);
    setResendCooldown(0);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
  }, []);

  return { stage, error, resendCooldown, sendCode, resendCode, confirmCode, reset };
}

function mapFirebaseError(err: any): string {
  const code = err?.code as string | undefined;
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That phone number doesn’t look right. Please check and try again.';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
      return 'Too many attempts. Please wait a bit and try again.';
    case 'auth/invalid-verification-code':
      return 'That code is incorrect. Please try again.';
    case 'auth/session-expired':
    case 'auth/code-expired':
      return 'This code has expired. Please request a new one.';
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.';
    default:
      return err?.message || 'Something went wrong. Please try again.';
  }
}
```

### 4.3 Screens

**Phone entry screen:**
```tsx
function PhoneEntryScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const { stage, error, sendCode } = useFirebasePhoneAuth();

  const handleSubmit = async () => {
    const e164 = toE164(phone);
    try {
      await sendCode(e164);
      navigation.navigate('OtpEntry', { phone: e164 });
    } catch {
      // error already set by the hook; screen re-renders with error text
    }
  };

  return (
    <View>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="9876543210"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button
        title={stage === 'sending' ? 'Sending…' : 'Send OTP'}
        onPress={handleSubmit}
        disabled={stage === 'sending'}
      />
    </View>
  );
}
```

**OTP entry screen** (note: the hook instance must be shared across both screens — via a context, a navigation param callback, or lifting the hook to a parent — since `confirmationRef` needs to persist between "send" and "confirm". The simplest approach is a small auth-flow context wrapping both screens):

```tsx
function OtpEntryScreen({ route }) {
  const { phone } = route.params;
  const [code, setCode] = useState('');
  const { stage, error, resendCooldown, confirmCode, resendCode } = useFirebasePhoneAuthContext();
  const { setAuthResult } = useAuth(); // your existing app auth context

  const handleConfirm = async () => {
    try {
      const result = await confirmCode(code);
      if (result.isNewUser) {
        // navigate to registration completion, carrying result.token (temp, 1h)
      } else {
        // existing user/chef — store result.token + result.user, same as
        // the current /verify-otp success path already does
        setAuthResult(result);
      }
    } catch {
      // error already set by the hook
    }
  };

  return (
    <View>
      <Text>Enter the code sent to {phone}</Text>
      <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button
        title={stage === 'confirming' ? 'Verifying…' : 'Verify'}
        onPress={handleConfirm}
        disabled={stage === 'confirming'}
      />
      <Button
        title={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
        onPress={() => resendCode(phone)}
        disabled={resendCooldown > 0}
      />
    </View>
  );
}
```

On Android, `@react-native-firebase/auth` combined with the SMS Retriever API can auto-fill the code without the user typing it — no extra app code needed beyond having the correct SHA fingerprints registered (§1); the code arrives via `onCodeAutoRetrievalTimeOut`/auto-fill callbacks the library wires up internally when `signInWithPhoneNumber` is used as shown above.

### 4.4 Handling the backend response

This is **identical** to however the app currently handles the `/auth/verify-otp` response — same fields (`isNewUser`, `isChef`, `registrationStep`, `applicationStatus`, `redirectToStatus`, `token`, `user`, `phone`). If there's an existing `handleOtpVerificationResult(result)` function or reducer action in the app, reuse it as-is rather than writing new branching logic.

### 4.5 Storing the resulting JWT

Whatever secure-storage mechanism the app already uses for the `/verify-otp` token, reuse it here — this doc won't prescribe a new one if one already exists. If none exists yet: use `react-native-keychain` (iOS Keychain / Android Keystore-backed) rather than plain `AsyncStorage`, since `AsyncStorage` is unencrypted on-device storage and this token grants full account access.

---

## 5. Error handling reference

| Source | Code / status | Meaning | Suggested UI |
|---|---|---|---|
| Firebase SDK | `auth/invalid-phone-number` | Bad format | "Check the number and try again" |
| Firebase SDK | `auth/too-many-requests`, `auth/quota-exceeded` | Firebase-side rate limit | "Too many attempts, try again later" |
| Firebase SDK | `auth/invalid-verification-code` | Wrong code | "Incorrect code" |
| Firebase SDK | `auth/session-expired`, `auth/code-expired` | Code timed out | "Code expired — resend" |
| Firebase SDK | `auth/network-request-failed` | Device offline / connectivity | "Check your connection" |
| Backend | `400` | Invalid/expired ID token, or token wasn't a phone-auth token | Rare — Firebase already validated the code before issuing the token. Treat as "please try again." |
| Backend | `429` | Rate-limited (10 req/min/IP on `/auth/verify-firebase-token`... actually see note below) | "Too many attempts, wait a minute" |
| Backend | `500` | Firebase Admin not configured server-side | Should never happen now that credentials are live — if seen, it's a backend incident, not a user-fixable error |

**Note on rate limiting:** double-check with backend which specific auth routes carry the 10-req/min limiter before assuming `/verify-firebase-token` is covered — confirm the exact route list rather than assuming parity with the MSG91 endpoints.

---

## 6. Testing

- **Firebase test phone numbers** (configured per §1): sign in with the fixed number + fixed code — no real SMS, works in CI, on simulators, and for app-store reviewers. This is the primary way to test the flow without live numbers.
- **Unit-test the hook** by mocking `@react-native-firebase/auth`'s `signInWithPhoneNumber`/`confirm` and `fetch` — verify state transitions (`idle → sending → awaiting-code → confirming → done`), cooldown countdown, and error-mapping for each Firebase error code in §5.
- **Manual device testing checklist:**
  - [ ] Real Android device, SMS auto-fill works (confirms SHA fingerprints are correct)
  - [ ] Real iOS device, no reCAPTCHA fallback appears (confirms APNs key + capabilities are correct)
  - [ ] Airplane-mode / offline handling shows the network error message, not a crash
  - [ ] Resend button respects the cooldown and actually re-sends after it elapses
  - [ ] New-user vs existing-user branching both work end-to-end against the real backend

---

## 7. Common pitfalls

- **Phone number format mismatch** — Firebase requires E.164 (`+91...`); if the app sends `91...` or `0...` to Firebase it'll reject it as invalid, but if it sends inconsistent formats to the *backend* elsewhere (registration, profile), lookups by phone could silently fail to match. Normalize once, at the point of input, and reuse everywhere.
- **iOS Simulator "always falls back to reCAPTCHA"** — expected; APNs silent push doesn't reach simulators. Not a bug, test on a real device or use a Firebase test number.
- **Android "code never auto-fills"** — almost always a missing/wrong SHA-1 or SHA-256 fingerprint in Firebase Console, or forgetting to add the *release* keystore's fingerprint (works in debug, breaks in a release build).
- **Forgetting the hook state needs to survive navigation between the phone-entry and OTP-entry screens** — the `ConfirmationResult` from `signInWithPhoneNumber` must be kept alive (in a context or lifted state), not re-created; if the hook is instantiated fresh on each screen, `confirmCode` has nothing to confirm against.
- **Testing against the wrong backend environment** — if the app is pointed at a `.env`/build config that talks to a backend without `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` configured, `/auth/verify-firebase-token` returns 500. Confirm which backend environment(s) have Firebase credentials live before testing (as of now, one has been verified working).

---

## 8. Rollout

See `docs/integrations/FIREBASE_OTP_FRONTEND_PLAN.md` §4 for the recommended feature-flagged, gradual rollout approach — keep the existing MSG91 send-otp/verify-otp flow in the app as a fallback rather than a hard cutover in one release.
