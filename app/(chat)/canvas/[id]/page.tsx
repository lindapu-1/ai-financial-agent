import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { CanvasView } from '@/components/canvas/canvas-view';
import { getChatById, getProjectById } from '@/lib/db/queries';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { ensureDbUserId } from '@/lib/auth/ensure-user';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  
  // 在 Canvas 路由下，id 既是 chatId 也是 projectId
  const [chat, project] = await Promise.all([
    getChatById({ id }),
    getProjectById({ id })
  ]);

  if (!project) {
    redirect('/');
  }

  const session = await auth();
  const dbUserId = session?.user?.email
    ? await ensureDbUserId(session.user.email)
    : null;

  if (project.userId !== dbUserId) {
    return notFound();
  }

  return (
    <>
      <CanvasView />
      <DataStreamHandler id={id} />
    </>
  );
}
