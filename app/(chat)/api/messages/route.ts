import { auth } from '@/app/(auth)/auth';
import { getMessagesByChatId } from '@/lib/db/queries';
import { convertToUIMessages } from '@/lib/utils';
import { ensureDbUserId } from '@/lib/auth/ensure-user';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session || !session.user || !session.user.email) {
    return new Response('Unauthorized', { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new Response('chatId is required', { status: 400 });
  }

  try {
    const messagesFromDb = await getMessagesByChatId({ id: chatId });
    const uiMessages = convertToUIMessages(messagesFromDb);
    return Response.json(uiMessages);
  } catch (error) {
    console.error('Failed to get messages:', error);
    return new Response('Failed to get messages', { status: 500 });
  }
}
