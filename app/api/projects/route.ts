import { auth } from '@/app/(auth)/auth';
import { getProjectsByUserId } from '@/lib/db/queries';

export async function GET() {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const projects = await getProjectsByUserId({ userId: session.user.id });

  return Response.json(projects);
}
