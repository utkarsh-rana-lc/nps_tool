import type { PoolClient } from 'pg';

export interface AccountRow {
  id: number;
  account_ref: string;
  name: string | null;
  timezone: string;
}

export interface UserRow {
  id: number;
  account_id: number;
  email: string;
  user_ref: string | null;
}

/** Idempotent upsert of an account by its platform-unique ref. */
export async function upsertAccount(
  client: PoolClient,
  accountRef: string,
  name?: string,
): Promise<AccountRow> {
  const { rows } = await client.query<AccountRow>(
    `INSERT INTO accounts (account_ref, name)
       VALUES ($1, $2)
     ON CONFLICT (account_ref) DO UPDATE
       SET name = COALESCE(EXCLUDED.name, accounts.name)
     RETURNING id, account_ref, name, timezone`,
    [accountRef, name ?? null],
  );
  return rows[0];
}

/** Idempotent upsert of a user within an account, keyed on email. */
export async function upsertUser(
  client: PoolClient,
  accountId: number,
  email: string,
  userRef?: string,
): Promise<UserRow> {
  const { rows } = await client.query<UserRow>(
    `INSERT INTO users (account_id, email, user_ref)
       VALUES ($1, $2, $3)
     ON CONFLICT (account_id, email) DO UPDATE
       SET user_ref = COALESCE(EXCLUDED.user_ref, users.user_ref)
     RETURNING id, account_id, email, user_ref`,
    [accountId, email.toLowerCase(), userRef ?? null],
  );
  return rows[0];
}
