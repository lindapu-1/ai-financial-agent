import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { MainContainer } from '@/components/main-container';
import { DEFAULT_MODEL_NAME, models } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';

export default async function Page() {
  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('model-id')?.value;

  const selectedModelId =
    models.find((model) => model.id === modelIdFromCookie)?.id ||
    DEFAULT_MODEL_NAME;

  return (
    <>
      <MainContainer
        id={id}
        selectedModelId={selectedModelId}
        initialMessages={[]}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
