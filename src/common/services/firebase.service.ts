import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let app: App | null = null;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    const error: any = new Error(`${name} is not configured`);
    error.status = 500;
    throw error;
  }
  return value;
}

function getFirebaseApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  const projectId = requireEnv('FIREBASE_PROJECT_ID');
  const clientEmail = requireEnv('FIREBASE_CLIENT_EMAIL');
  // Private keys are stored in .env with literal \n escapes; convert back to real newlines.
  const privateKey = requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });

  return app;
}

/**
 * Verifies a Firebase Phone Auth ID token and returns the verified phone
 * number. Throws if the token is invalid/expired or wasn't issued for phone sign-in.
 */
export async function verifyFirebasePhoneToken(idToken: string): Promise<string> {
  const decoded = await getAuth(getFirebaseApp()).verifyIdToken(idToken);

  const phoneNumber = decoded.phone_number;
  if (!phoneNumber) {
    const error: any = new Error('ID token was not issued for phone sign-in');
    error.status = 400;
    throw error;
  }

  return phoneNumber;
}
