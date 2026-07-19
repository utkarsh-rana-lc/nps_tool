/**
 * Bootstrap the first dashboard admin (or add any user from the CLI).
 *
 *   pnpm --filter @limechat-nps/server create-admin -- \
 *     --email you@limechat.ai --name "You" --password "at-least-10-chars" [--role admin]
 *
 * If a user with that email already exists, this is a no-op.
 */
import { closePool } from './db.js';
import { createUser } from './services/auth.js';
import * as repo from './repositories/dashboardUsers.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('email') ?? process.env.ADMIN_EMAIL;
  const password = arg('password') ?? process.env.ADMIN_PASSWORD;
  const name = arg('name') ?? process.env.ADMIN_NAME;
  const role = (arg('role') ?? 'admin') === 'viewer' ? 'viewer' : 'admin';

  if (!email || !password) {
    console.error('Usage: create-admin --email <e> --password <p> [--name <n>] [--role admin|viewer]');
    process.exit(1);
  }

  const existing = await repo.findByEmail(email);
  if (existing) {
    console.log(`· user ${email} already exists (id ${existing.id}) — nothing to do`);
    await closePool();
    return;
  }

  const user = await createUser({ email, name, password, role });
  console.log(`✓ created ${role}: ${user.email} (id ${user.id})`);
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool();
  process.exit(1);
});
