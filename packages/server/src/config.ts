export interface Config {
  port: number;
  databaseUrl: string;
  corsOrigins: string[] | true;
  adminApiKey: string;
  writeKeys: Set<string>;
  /** Secret used to sign dashboard session tokens (HS256). */
  jwtSecret: string;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function loadConfig(): Config {
  const originsRaw = process.env.CORS_ORIGINS ?? '*';
  const corsOrigins = originsRaw.trim() === '*'
    ? true
    : originsRaw.split(',').map((s) => s.trim()).filter(Boolean);

  return {
    port: Number(process.env.PORT ?? 4000),
    databaseUrl: required('DATABASE_URL'),
    corsOrigins,
    adminApiKey: process.env.ADMIN_API_KEY ?? 'sk_admin_change_me',
    writeKeys: new Set(
      (process.env.WRITE_KEYS ?? 'pk_live_demo,pk_test_demo')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    jwtSecret: process.env.JWT_SECRET ?? 'dev_jwt_secret_change_me',
  };
}
