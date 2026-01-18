import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { DEFAULT_MODEL_NAME, models } from '@/lib/ai/models';
import { getChatById, getMessagesByChatId } from '@/lib/db/queries';
import { convertToUIMessages } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { ensureDbUserId } from '@/lib/auth/ensure-user';

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id } = params;
  const chat = await getChatById({ id });

  if (!chat) {
    redirect('/');
  }

  const session = await auth();
  const dbUserId = session?.user?.email
    ? await ensureDbUserId(session.user.email)
    : null;

  if (chat.visibility === 'private') {
    if (!session || !session.user) {
      return notFound();
    }

    if (!dbUserId || dbUserId !== chat.userId) {
      return notFound();
    }
  }

  // 核心防御逻辑：如果这个 ID 实际上是一个项目，重定向到 /canvas 路由
  if (chat.projectId) {
    redirect(`/canvas/${chat.id}`);
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('model-id')?.value;
  const selectedModelId =
    models.find((model) => model.id === modelIdFromCookie)?.id ||
    DEFAULT_MODEL_NAME;

  return (
    <>
      <Chat
        id={chat.id}
        initialMessages={convertToUIMessages(messagesFromDb)}
        selectedModelId={selectedModelId}
        selectedVisibilityType={chat.visibility}
        isReadonly={false}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
