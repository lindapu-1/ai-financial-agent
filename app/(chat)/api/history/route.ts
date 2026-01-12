import { auth } from '@/app/(auth)/auth';
import { getChatsByUserId } from '@/lib/db/queries';
import { ensureDbUserId } from '@/lib/auth/ensure-user';

export async function GET() {
  const session = await auth();

  if (!session || !session.user) {
    return Response.json('Unauthorized!', { status: 401 });
  }

  if (!session.user.email) {
    return Response.json('Unauthorized!', { status: 401 });
  }

  const dbUserId = await ensureDbUserId(session.user.email);
  const chats = await getChatsByUserId({ id: dbUserId });
  return Response.json(chats);
}
