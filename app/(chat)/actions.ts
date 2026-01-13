'use server';

import { type CoreUserMessage, generateText } from 'ai';
import { cookies } from 'next/headers';

import { customModel } from '@/lib/ai';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
  saveProject as saveProjectQuery,
  getProjectsByUserId as getProjectsByUserIdQuery,
  updateProjectContent as updateProjectContentQuery,
  deleteProjectById as deleteProjectByIdQuery,
  saveSkill as saveSkillQuery,
  getSkillsByUserId as getSkillsByUserIdQuery,
  updateSkill as updateSkillQuery,
  deleteSkillById as deleteSkillByIdQuery,
} from '@/lib/db/queries';
import { VisibilityType } from '@/components/visibility-selector';
import { auth } from '../(auth)/auth';
import { revalidatePath } from 'next/cache';

export async function saveModelId(model: string) {
  const cookieStore = await cookies();
  cookieStore.set('model-id', model);
}

export async function generateTitleFromUserMessage({
  message,
  modelId,
  modelApiKey,
}: {
  message: CoreUserMessage;
  modelId: string;
  modelApiKey: string;
}) {
  const { text: title } = await generateText({
    model: customModel(modelId, modelApiKey),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 30 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}

export async function saveProject({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthorized');
  }

  await saveProjectQuery({ id, name, userId: session.user.id });
  revalidatePath('/');
}

export async function getProjectsByUserId() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return [];
  }

  return await getProjectsByUserIdQuery({ userId: session.user.id });
}

export async function updateProjectContent({
  id,
  content,
}: {
  id: string;
  content: string;
}) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthorized');
  }

  await updateProjectContentQuery({ id, content });
}

export async function deleteProjectById({ id }: { id: string }) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthorized');
  }

  await deleteProjectByIdQuery({ id });
  revalidatePath('/');
}

export async function getSkillsByUserId() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    return [];
  }

  return await getSkillsByUserIdQuery({ userId: session.user.id });
}

export async function saveSkill({
  id,
  name,
  prompt,
}: {
  id: string;
  name: string;
  prompt: string;
}) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthorized');
  }

  await saveSkillQuery({ id, name, prompt, userId: session.user.id });
  revalidatePath('/');
}

export async function updateSkill({
  id,
  name,
  prompt,
}: {
  id: string;
  name: string;
  prompt: string;
}) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthorized');
  }

  await updateSkillQuery({ id, name, prompt });
  revalidatePath('/');
}

export async function deleteSkillById({ id }: { id: string }) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    throw new Error('Unauthorized');
  }

  await deleteSkillByIdQuery({ id });
  revalidatePath('/');
}
