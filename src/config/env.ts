function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not defined in the environment variables`);
  }
  return value;
}

export const JWT_SECRET = requireEnv('JWT_SECRET');
