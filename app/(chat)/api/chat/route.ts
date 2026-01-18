import {
  type Message,
  convertToCoreMessages,
  createDataStreamResponse,
  generateObject,
  streamText,
} from 'ai';
import { z } from 'zod';

import { auth } from '@/app/(auth)/auth';
import { customModel } from '@/lib/ai';
import { models } from '@/lib/ai/models';
import {
  systemPrompt,
} from '@/lib/ai/prompts';
import {
  CANVAS_SYSTEM_PROMPT,
  SKILL_PROMPTS,
} from '@/lib/ai/prompts-canvas';
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
  getProjectById,
  getSkillById,
} from '@/lib/db/queries';
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';
import { ensureDbUserId } from '@/lib/auth/ensure-user';

import { generateTitleFromUserMessage } from '../../actions';
import { AISDKExporter } from 'langsmith/vercel';
import { 
  FinancialToolsManager, 
  financialTools, 
  type AllowedTools 
} from '@/lib/ai/tools/financial-tools';
import {
  WebSearchToolsManager,
} from '@/lib/ai/tools/web-search-tools';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const allTools: AllowedTools[] = [...financialTools];

function isPlaceholderKey(value: string | undefined | null) {
  const v = (value ?? '').trim();
  if (!v) return true;
  return (
    v === '****' ||
    v === 'changeme' ||
    v === 'your-openai-api-key' ||
    v === 'your-financial-datasets-api-key'
  );
}

export async function POST(request: Request) {
  try {
    const {
      id,
      messages,
      modelId,
      financialDatasetsApiKey,
      modelApiKey,
      mode = 'general',
      projectId,
      skillId,
    }: {
      id: string;
      messages: Array<Message>;
      modelId: string;
      financialDatasetsApiKey?: string;
      modelApiKey?: string;
      mode?: 'general' | 'canvas';
      projectId?: string;
      skillId?: string;
    } = await request.json();

    const session = await auth();

  if (!session || !session.user || !session.user.email) {
    return new Response('Unauthorized', { status: 401 });
  }
  const dbUserId = await ensureDbUserId(session.user.email);

  const model = models.find((model) => model.id === modelId);

  if (!model) {
    return new Response('Model not found', { status: 404 });
  }

  // ... (API key logic remains same)
  let effectiveModelApiKey = modelApiKey?.trim();
  if (!effectiveModelApiKey) {
    if (model.provider === 'openai') effectiveModelApiKey = process.env.OPENAI_API_KEY;
    if (model.provider === 'google') effectiveModelApiKey = process.env.GOOGLE_API_KEY;
    if (model.provider === 'deepseek') effectiveModelApiKey = process.env.DEEPSEEK_API_KEY;
  }
  
  const effectiveFinancialDatasetsApiKey = (
    financialDatasetsApiKey ?? process.env.FINANCIAL_DATASETS_API_KEY
  )?.trim();

  if (isPlaceholderKey(effectiveModelApiKey)) {
    return new Response(
      `Model API key is required (set ${model.provider.toUpperCase()}_API_KEY in .env or provide modelApiKey from the client)`,
      { status: 400 },
    );
  }

  const coreMessages = convertToCoreMessages(messages);
  const userMessage = getMostRecentUserMessage(coreMessages);

  if (!userMessage) {
    return new Response('No user message found', { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({
      message: userMessage,
      modelId: model.apiIdentifier,
      modelApiKey: effectiveModelApiKey,
    });
    await saveChat({ id, userId: dbUserId, title, projectId });
  }

  const userMessageId = generateUUID();

  await saveMessages({
    messages: [
      { ...userMessage, id: userMessageId, createdAt: new Date(), chatId: id },
    ],
  });

  return createDataStreamResponse({
    execute: async (dataStream) => {
      dataStream.writeData({
        type: 'user-message-id',
        content: userMessageId,
      });

      // --- CANVAS 模式逻辑 ---
      if (mode === 'canvas') {
        try {
          let selectedSkillName = '专项分析';
          let skillPromptContent = '';

          // 1. 获取项目上下文 (先放上下文)
          let projectContent = '';
          if (projectId) {
            try {
              const project = await getProjectById({ id: projectId });
              if (project && project.content) {
                projectContent = project.content;
              }
            } catch (error) {
              console.error('Failed to get project:', error);
              // 继续执行，即使获取项目失败
            }
          }

          // 2. 获取技能 Prompt (后放指令，增强指令遵循)
          if (skillId) {
            try {
              const skill = await getSkillById({ id: skillId });
              if (skill) {
                skillPromptContent = `\n\n【关键指令 - 必须严格执行】\n你当前正在执行 "${skill.name}" 专项技能。请务必遵循以下格式和内容要求进行输出：\n${skill.prompt}`;
                selectedSkillName = skill.name;
              }
            } catch (error) {
              console.error('Failed to get skill:', error);
              // 继续执行，即使获取技能失败
            }
          }

        // 3. 组装最终 System Prompt
        // 将最重要的技能指令放在最后，利用模型的“近因效应”
        const canvasSystemPrompt = `
${CANVAS_SYSTEM_PROMPT}

---
【参考上下文 (Project Context)】:
${projectContent || '（编辑器目前内容较少，请确保已粘贴足够的项目素材）'}
---

${skillPromptContent}

【回复准则】:
- 请直接输出报告内容。
- 如果用户提出了特定问题，请结合上述上下文和技能要求进行回答。
- 确保你的语气专业且严谨。
- **即便上下文很长，也请优先寻找其中的信息。不要回复“请粘贴素材”。**
`.trim();

        // 发送正在思考的状态
        dataStream.writeData({
          type: 'query-loading',
          content: {
            isLoading: true,
            taskNames: [`正在进行${selectedSkillName}`]
          }
        });

        let receivedFirstChunk = false;

        const result = streamText({
          model: customModel(model.apiIdentifier, effectiveModelApiKey),
          system: canvasSystemPrompt,
          messages: coreMessages,
          onChunk: () => {
            if (!receivedFirstChunk) {
              receivedFirstChunk = true;
              // 收到第一块数据时，关闭加载状态
              dataStream.writeData({
                type: 'query-loading',
                content: {
                  isLoading: false,
                  taskNames: []
                }
              });
            }
          },
          onFinish: async ({ response }) => {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            if (dbUserId) {
              try {
                const responseMessages = sanitizeResponseMessages(response.messages);
                if (responseMessages.length > 0) {
                  await saveMessages({
                    messages: responseMessages.map((message) => {
                      const messageId = generateUUID();
                      if (message.role === 'assistant') {
                        dataStream.writeMessageAnnotation({ messageIdFromServer: messageId });
                      }
                      return {
                        id: messageId,
                        chatId: id,
                        role: message.role,
                        content: message.content,
                        createdAt: new Date(),
                      };
                    }),
                  });
                }
              } catch (error) {
                console.error('Failed to save canvas chat:', error);
              }
            }
          },
        });

          result.mergeIntoDataStream(dataStream);
          return;
        } catch (error) {
          console.error('Canvas mode error:', error);
          console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          try {
            dataStream.writeData({
              type: 'error',
              content: `处理请求时出错: ${error instanceof Error ? error.message : '未知错误'}`,
            });
          } catch (streamError) {
            console.error('Failed to write error to stream:', streamError);
          }
          // 不抛出错误，让流正常结束
          return;
        }
      }

      // --- GENERAL 模式逻辑 (原有逻辑) ---
      // Initialize tools only when we have a Financial Datasets API key.
      const financialToolsManager =
        !isPlaceholderKey(effectiveFinancialDatasetsApiKey)
        ? new FinancialToolsManager({
            financialDatasetsApiKey: effectiveFinancialDatasetsApiKey,
            dataStream,
          })
        : null;

      // Initialize web search tools when we have a Tavily API key.
      const tavilyApiKey = process.env.TAVILY_API_KEY?.trim();
      const webSearchToolsManager = tavilyApiKey && !isPlaceholderKey(tavilyApiKey)
        ? new WebSearchToolsManager({
            tavilyApiKey,
            dataStream,
          })
        : null;

      dataStream.writeData({
        type: 'query-loading',
        content: {
          isLoading: true,
          taskNames: []
        }
      });

      const { object } = await generateObject({
        // Use the selected model for task planning to avoid "no access" errors
        // on projects that don't have access to specific model snapshots.
        model: customModel(model.apiIdentifier, effectiveModelApiKey),
        output: 'array',
        schema: z.object({
          task_name: z.string(),
          class: z
            .string()
            .describe('The name of the sub-task'),
        }),
        prompt: `You are a financial reasoning agent.  
        Given the following user query: ${userMessage.content}, 
        break it down to small, tightly-scoped sub-tasks 
        that need to be taken to answer the query.  
        
        Your task breakdown should:
        - Be comprehensive and cover all aspects needed to fully answer the query
        - Follow a logical research sequence from basic information to deeper analysis
        - Include 1-3 tasks maximum - fewer is better as long as they cover the complete question
        - Prioritize the most essential research steps and consolidate similar actions
        - Start with gathering fundamental data before moving to analysis and comparison
        - Make thought processes transparent to users who will see these tasks
        - Show a clear progression of reasoning that builds toward the answer
        
        Format requirements:
        - Include the ticker or company name where appropriate
        - Use present progressive tense (e.g., "Analyzing", "Retrieving", "Comparing")
        - Keep task names short (3-7 words) but specific and informative
        - Make tasks distinct with no overlap or redundancy
        - Begin with data collection tasks, then move to analysis tasks
        
        Your output will guide another LLM in executing these tasks, and users will see these steps as the system works.
        Ensure tasks are optimally structured for the available financial tools and clearly communicate the research approach.
        Focus on minimizing the number of steps while maintaining comprehensiveness.
        
        Examples of good task sequences:
        - "Retrieving AAPL financials", "Analyzing AAPL performance trends" 
        - "Finding top tech stocks", "Evaluating financial health"`,
      });

      // Stream the tasks in the query loading state
      dataStream.writeData({
        type: 'query-loading',
        content: {
          isLoading: true,
          taskNames: object.map(task => task.task_name)
        }
      });

      let receivedFirstChunk = false;

      // Create a transient version of coreMessages with task names
      const coreMessagesWithTaskNames = [...coreMessages];
      // Replace the last user message content with task names
      const lastMessage = coreMessagesWithTaskNames[coreMessagesWithTaskNames.length - 1];
      if (coreMessagesWithTaskNames.length > 0 && lastMessage?.role === 'user') {
        const taskList = object.map(task => task.task_name).join('\n');
        coreMessagesWithTaskNames[coreMessagesWithTaskNames.length - 1] = {
          role: 'user',
          content: taskList
        };
      }

      // Merge all available tools
      const allTools = {
        ...(financialToolsManager ? financialToolsManager.getTools() : {}),
        ...(webSearchToolsManager ? webSearchToolsManager.getTools() : {}),
      };

      const result = streamText({
        model: customModel(model.apiIdentifier, effectiveModelApiKey),
        tools: allTools,
        system: systemPrompt,
        messages: coreMessagesWithTaskNames,
        maxSteps: 10,
        onChunk: (event) => {
          const isToolCall = event.chunk.type === 'tool-call';
          if (!receivedFirstChunk && !isToolCall) {
            receivedFirstChunk = true;
            // Set query-loading to false on first token
            dataStream.writeData({
              type: 'query-loading',
              content: {
                isLoading: false,
                taskNames: []
              }
            });
          }
        },
        onFinish: async ({ response }) => {
          // CAUTION: this is a hack to prevent stream from being cut off :(
          // TODO: find a better solution
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // save the response
          if (dbUserId) {
            try {
              const responseMessagesWithoutIncompleteToolCalls = sanitizeResponseMessages(response.messages);

              if (responseMessagesWithoutIncompleteToolCalls.length > 0) {
                await saveMessages({
                  messages: responseMessagesWithoutIncompleteToolCalls.map(
                    (message) => {
                      const messageId = generateUUID();

                      if (message.role === 'assistant') {
                        dataStream.writeMessageAnnotation({
                          messageIdFromServer: messageId,
                        });
                      }

                      return {
                        id: messageId,
                        chatId: id,
                        role: message.role,
                        content: message.content,
                        createdAt: new Date(),
                      };
                    },
                  ),
                });
              } else {
                console.log('No valid messages to save');
              }
            } catch (error) {
              console.error('Failed to save chat:', error);
            }
          }
        },
      });

      result.mergeIntoDataStream(dataStream);
    },
  });
  } catch (error) {
    console.error('POST /api/chat error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
    });
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : '未知错误',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
