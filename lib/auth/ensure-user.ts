import 'server-only';

import { createUser, getUser } from '@/lib/db/queries';

/**
 * Ensures there is a User row for the given email and returns its id.
 *
 * This is a pragmatic guard for local/dev where the DB may be recreated while
 * the browser still holds an auth session cookie referencing an old user id.
 */
export async function ensureDbUserId(email: string): Promise<string> {
  const users = await getUser(email);
  if (users.length > 0) return users[0]!.id;

  // Create a placeholder password (not used for auth in this app).
  await createUser(email, Math.random().toString(36));

  const created = await getUser(email);
  if (created.length === 0) {
    throw new Error(`Failed to ensure user for email: ${email}`);
  }

  return created[0]!.id;
}

