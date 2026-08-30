/**
 * Global test substitute for src/common/services/firebase.service.ts, wired up
 * via jest's moduleNameMapper (see package.json). The real module pulls in
 * firebase-admin -> jose/jwks-rsa, which ship ESM that Jest's default
 * CommonJS transform can't parse. Firebase Phone Auth token verification
 * itself is out of scope for automation (see docs/testing/TEST_PLAN.md §7) —
 * covered manually in UAT instead.
 */
export const verifyFirebasePhoneToken = jest.fn();
