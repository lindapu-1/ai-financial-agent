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
      modelApiKey: effectiveModelApiKey!,
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
        const requestStartTime = Date.now();
        console.log('[Canvas Mode] ========== REQUEST START ==========');
        console.log('[Canvas Mode] Starting canvas mode request', {
          timestamp: new Date().toISOString(),
          requestId: id.substring(0, 8),
          projectId,
          skillId,
          modelId: model.apiIdentifier,
          messagesCount: coreMessages.length,
          lastUserMessage: (() => {
            const lastMsg = coreMessages[coreMessages.length - 1];
            if (!lastMsg || !lastMsg.content) return 'no content';
            if (typeof lastMsg.content === 'string') return lastMsg.content.substring(0, 100);
            return 'non-string content';
          })(),
        });

        try {
          let selectedSkillName = '专项分析';
          let skillPromptContent = '';

          // 1. 获取项目上下文 (先放上下文)
          let projectContent = '';
          if (projectId) {
            try {
              console.log('[Canvas Mode] Fetching project:', projectId);
              const project = await getProjectById({ id: projectId });
              console.log('[Canvas Mode] Project fetched:', {
                exists: !!project,
                hasContent: !!(project && project.content),
                contentLength: project?.content?.length || 0,
              });

              if (project && project.content) {
                // 解析新的文件卡片格式：分离可见内容和隐藏的文件内容
                const HIDDEN_DATA_SEPARATOR = '\n\n--- DO NOT EDIT BELOW THIS LINE ---\n';
                const parts = project.content.split(HIDDEN_DATA_SEPARATOR);
                let visibleContent = parts[0] || '';
                const hiddenData = parts.length > 1 ? parts[1] : '';

                console.log('[Canvas Mode] Parsing content:', {
                  visibleLength: visibleContent.length,
                  hasHiddenData: !!hiddenData,
                  hiddenDataLength: hiddenData.length,
                });

                // 解析隐藏的文件内容
                let filesMap: Record<string, string> = {};
                try {
                  if (hiddenData.trim()) {
                    filesMap = JSON.parse(hiddenData.trim());
                    console.log('[Canvas Mode] Parsed files:', Object.keys(filesMap));
                  }
                } catch (e) {
                  console.warn('[Canvas Mode] Failed to parse hidden file data:', e);
                }

                // 将文件内容合并到可见内容中
                // 格式：可见内容 + 文件内容（按文件名排序，确保一致性）
                const fileContents = Object.entries(filesMap)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([fileName, content]) => {
                    return `\n\n--- 文件: ${fileName} ---\n${content}\n--- 文件结束 ---\n`;
                  })
                  .join('');

                // 移除可见内容中的文件标记（[FILE:...]），只保留实际文本
                visibleContent = visibleContent.replace(/\[FILE:[^\]]+\]/g, '').trim();

                // 合并最终内容
                projectContent = visibleContent + fileContents;
                console.log('[Canvas Mode] Final project content length:', projectContent.length);
              } else {
                console.log('[Canvas Mode] No project content found');
              }
            } catch (error) {
              console.error('[Canvas Mode] Failed to get project:', error);
              // 继续执行，即使获取项目失败
            }
          } else {
            console.log('[Canvas Mode] No projectId provided');
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
        // 将最重要的技能指令放在最后，利用模型的"近因效应"
        const baseSystemPrompt = CANVAS_SYSTEM_PROMPT.trim();
        const canvasSystemPrompt = `
${baseSystemPrompt}

---
【参考上下文 (Project Context)】:
${projectContent || '（编辑器目前内容较少，请确保已粘贴足够的项目素材）'}
---

${skillPromptContent}

【回复准则】:
- 请直接输出报告内容。
- 如果用户提出了特定问题，请结合上述上下文和技能要求进行回答。
- 确保你的语气专业且严谨。
- **即便上下文很长，也请优先寻找其中的信息。不要回复"请粘贴素材"。**
`.trim();

        // 计算 user prompt 的总长度（所有消息的内容）
        const userPromptLength = coreMessages.reduce((sum, m) => {
          if (typeof m.content === 'string') {
            return sum + m.content.length;
          } else if (Array.isArray(m.content)) {
            return sum + JSON.stringify(m.content).length;
          }
          return sum + String(m.content).length;
        }, 0);

        console.log('[Canvas Mode] 📊 PROMPT LENGTH ANALYSIS', {
          timestamp: new Date().toISOString(),
          baseSystemPromptLength: baseSystemPrompt.length,
          projectContentLength: projectContent.length,
          skillPromptLength: skillPromptContent.length,
          totalSystemPromptLength: canvasSystemPrompt.length,
          userPromptLength: userPromptLength,
          userMessagesCount: coreMessages.length,
          totalInputLength: canvasSystemPrompt.length + userPromptLength,
          // 估算 token 数量（粗略：1 token ≈ 4 字符）
          estimatedSystemTokens: Math.round(canvasSystemPrompt.length / 4),
          estimatedUserTokens: Math.round(userPromptLength / 4),
          estimatedTotalTokens: Math.round((canvasSystemPrompt.length + userPromptLength) / 4),
        });

        console.log('[Canvas Mode] Starting streamText', {
          projectId,
          projectContentLength: projectContent.length,
          messagesCount: coreMessages.length,
          modelId: model.apiIdentifier,
        });

        // 发送正在思考的状态
        dataStream.writeData({
          type: 'query-loading',
          content: {
            isLoading: true,
            taskNames: [`正在进行${selectedSkillName}`]
          }
        });

        // 使用对象来确保引用稳定，避免闭包问题
        const chunkState = {
          receivedFirstChunk: false,
          chunkCount: 0,
          firstChunkTime: null as number | null,
          streamStartTime: Date.now(),
        };
        
        // 用于等待第一个 chunk 的 Promise
        let firstChunkResolver: (() => void) | null = null;
        const firstChunkPromise = new Promise<void>((resolve) => {
          firstChunkResolver = resolve;
        });

        try {
          console.log('[Canvas Mode] Calling streamText', {
            timestamp: new Date().toISOString(),
            timeSinceStart: chunkState.streamStartTime - requestStartTime,
            systemPromptLength: canvasSystemPrompt.length,
            messagesCount: coreMessages.length,
            totalInputTokens: canvasSystemPrompt.length + coreMessages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length), 0),
          });

        const result = streamText({
          model: customModel(model.apiIdentifier, effectiveModelApiKey),
          system: canvasSystemPrompt,
          messages: coreMessages,
            onChunk: ({ chunk }) => {
              chunkState.chunkCount++;
              const isToolCall = chunk.type === 'tool-call';
              const chunkTime = Date.now();
              
              if (!chunkState.receivedFirstChunk && !isToolCall) {
                chunkState.receivedFirstChunk = true;
                chunkState.firstChunkTime = chunkTime;
                console.log('[Canvas Mode] ✅ FIRST CHUNK RECEIVED', {
                  timestamp: new Date().toISOString(),
                  timeSinceStart: chunkTime - requestStartTime,
                  timeSinceStreamStart: chunkTime - chunkState.streamStartTime,
                  chunkType: chunk.type,
                  chunkCount: 1,
                });
              // 收到第一块数据时，关闭加载状态
              dataStream.writeData({
                type: 'query-loading',
                content: {
                  isLoading: false,
                  taskNames: []
                }
              });
                // 解析等待 Promise
                if (firstChunkResolver) {
                  firstChunkResolver();
                  firstChunkResolver = null;
                }
              } else if (chunkState.chunkCount % 50 === 0) {
                // 每 50 个 chunk 记录一次进度
                console.log('[Canvas Mode] Chunk progress', {
                  chunkCount: chunkState.chunkCount,
                  chunkType: chunk.type,
                  timeSinceStart: chunkTime - requestStartTime,
              });
            }
          },
            onFinish: async ({ response, finishReason }) => {
              const finishTime = Date.now();
              const assistantMessage = response.messages.find(m => m.role === 'assistant');
              const assistantContent = assistantMessage?.content;
              const contentPreview = typeof assistantContent === 'string' 
                ? assistantContent.substring(0, 100)
                : Array.isArray(assistantContent)
                ? JSON.stringify(assistantContent).substring(0, 100)
                : String(assistantContent).substring(0, 100);
              
              const totalTime = finishTime - requestStartTime;
              const streamTime = finishTime - chunkState.streamStartTime;
              const timeToFirstChunk = chunkState.firstChunkTime ? chunkState.firstChunkTime - chunkState.streamStartTime : null;
              
              console.log('[Canvas Mode] ✅ STREAM FINISHED', {
                timestamp: new Date().toISOString(),
                totalTimeMs: totalTime,
                streamTimeMs: streamTime,
                timeToFirstChunkMs: timeToFirstChunk,
                chunkCount: chunkState.chunkCount,
                responseMessagesCount: response.messages.length,
                finishReason,
                hasContent: response.messages.some(m => m.role === 'assistant' && m.content),
                receivedFirstChunk: chunkState.receivedFirstChunk,
                assistantMessageLength: typeof assistantContent === 'string' ? assistantContent.length : JSON.stringify(assistantContent).length,
                assistantMessageContent: contentPreview,
              });
              
              // 如果从未收到第一个 chunk，但流已经完成，说明可能是空响应或流式响应被跳过
              if (!chunkState.receivedFirstChunk) {
                console.warn('[Canvas Mode] Stream finished but no chunks were received', {
                  finishReason,
                  responseMessagesCount: response.messages.length,
                });
                // 即使没有收到 chunk，也要关闭加载状态
                dataStream.writeData({
                  type: 'query-loading',
                  content: {
                    isLoading: false,
                    taskNames: []
                  }
                });
              }
              
            await new Promise((resolve) => setTimeout(resolve, 1000));
            if (dbUserId) {
              try {
                const responseMessages = sanitizeResponseMessages(response.messages);
                  console.log('[Canvas Mode] Sanitized messages count:', responseMessages.length);
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
                    console.log('[Canvas Mode] Messages saved successfully');
                  } else {
                    console.warn('[Canvas Mode] No valid messages to save');
                  }
                } catch (error) {
                  console.error('[Canvas Mode] Failed to save canvas chat:', error);
                }
              }
            },
          });

          const mergeStartTime = Date.now();
          console.log('[Canvas Mode] Merging result into data stream', {
            timestamp: new Date().toISOString(),
            timeSinceStart: mergeStartTime - requestStartTime,
            systemPromptLength: canvasSystemPrompt.length,
            messagesCount: coreMessages.length,
          });
          
          // 添加超时检测：如果 5 秒内没有收到第一个 chunk，记录警告并关闭加载状态
          const timeoutId = setTimeout(() => {
            if (!chunkState.receivedFirstChunk) {
              console.warn('[Canvas Mode] ⚠️ TIMEOUT: No first chunk received after 5 seconds', {
                timestamp: new Date().toISOString(),
                timeSinceStart: Date.now() - requestStartTime,
                systemPromptLength: canvasSystemPrompt.length,
                messagesCount: coreMessages.length,
              });
              // 超时后强制关闭加载状态
              dataStream.writeData({
                type: 'query-loading',
                content: {
                  isLoading: false,
                  taskNames: []
                }
              });
              
              // 发送超时错误消息给用户
              dataStream.writeData({
                type: 'text-delta',
                content: '\n\n⚠️ **响应超时**\n\n模型响应时间超过5秒，可能是由于上下文内容过多（当前有 ' + coreMessages.length + ' 条消息，系统提示词 ' + Math.round(canvasSystemPrompt.length / 1000) + 'k 字符）。\n\n**建议**：\n1. 尝试简化问题或缩短上下文\n2. 点击"停止"按钮后重新发送消息\n3. 如果问题持续，请检查网络连接或稍后重试\n\n'
              });
              
              // 解析等待 Promise（如果还在等待）
              if (firstChunkResolver) {
                firstChunkResolver();
                firstChunkResolver = null;
              }
            }
          }, 5000);
          
          try {
            console.log('[Canvas Mode] Calling mergeIntoDataStream...');
            
            // 启动流式响应（不等待完成）
            const mergePromise = result.mergeIntoDataStream(dataStream);
            
            // 等待第一个 chunk 或超时（最多等待 5 秒）
            const firstChunkTimeout = setTimeout(() => {
              if (firstChunkResolver) {
                firstChunkResolver();
                firstChunkResolver = null;
              }
            }, 5000);
            
            // 如果已经收到第一个 chunk，立即解析
            if (chunkState.receivedFirstChunk) {
              clearTimeout(firstChunkTimeout);
            } else {
              await firstChunkPromise;
              clearTimeout(firstChunkTimeout);
            }
            
            // 然后等待 mergeIntoDataStream 完成
            await mergePromise;
            clearTimeout(timeoutId);
            
            const mergeEndTime = Date.now();
            const mergeTime = mergeEndTime - mergeStartTime;
            
            // 等待一小段时间，确保 onFinish 回调有机会执行
            await new Promise((resolve) => setTimeout(resolve, 1000));
            
            const finalTime = Date.now();
            console.log('[Canvas Mode] Stream merge completed', {
              timestamp: new Date().toISOString(),
              totalTimeMs: finalTime - requestStartTime,
              mergeTimeMs: mergeTime,
              receivedFirstChunk: chunkState.receivedFirstChunk,
              chunkCount: chunkState.chunkCount,
              systemPromptLength: canvasSystemPrompt.length,
            });
            
            // 如果 mergeIntoDataStream 完成但没有收到任何 chunk，强制关闭加载状态
            // 这可能发生在系统 prompt 太长或模型响应异常的情况下
            if (!chunkState.receivedFirstChunk) {
              console.warn('[Canvas Mode] ❌ FAILURE: mergeIntoDataStream completed but no chunks received', {
                timestamp: new Date().toISOString(),
                totalTimeMs: finalTime - requestStartTime,
                systemPromptLength: canvasSystemPrompt.length,
                messagesCount: coreMessages.length,
              });
              
              // 强制关闭加载状态
              dataStream.writeData({
                type: 'query-loading',
                content: {
                  isLoading: false,
                  taskNames: []
                }
              });
              
              // 发送错误消息给用户
              dataStream.writeData({
                type: 'text-delta',
                content: '\n\n⚠️ **响应超时**\n\n抱歉，模型响应时间过长（超过5秒），可能是由于以下原因：\n- 上下文内容过多（当前有 ' + coreMessages.length + ' 条消息）\n- 系统提示词较长（' + Math.round(canvasSystemPrompt.length / 1000) + 'k 字符）\n\n**建议**：\n1. 尝试简化问题或缩短上下文\n2. 点击"停止"按钮后重新发送消息\n3. 如果问题持续，请检查网络连接或稍后重试\n\n'
              });
              
              // 发送 finish 信号
              dataStream.writeData({
                type: 'finish',
                content: ''
              });
            } else {
              console.log('[Canvas Mode] ✅ SUCCESS: Request completed successfully');
            }
            
            console.log('[Canvas Mode] ========== REQUEST END ==========');
          } catch (mergeError) {
            clearTimeout(timeoutId);
            console.error('[Canvas Mode] mergeIntoDataStream error:', mergeError);
            console.error('[Canvas Mode] Error details:', {
              message: mergeError instanceof Error ? mergeError.message : 'Unknown error',
              stack: mergeError instanceof Error ? mergeError.stack : 'No stack trace',
            });
            
            // 即使出错，也要关闭加载状态
            dataStream.writeData({
              type: 'query-loading',
              content: {
                isLoading: false,
                taskNames: []
              }
            });
            
            throw mergeError;
          }
          
          return;
        } catch (streamError) {
          console.error('[Canvas Mode] streamText error:', streamError);
          throw streamError; // 重新抛出，让外层 catch 处理
        }
        } catch (error) {
          console.error('[Canvas Mode] Error in canvas mode:', error);
          console.error('[Canvas Mode] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          try {
            // 关闭加载状态
            dataStream.writeData({
              type: 'query-loading',
              content: {
                isLoading: false,
                taskNames: []
              }
            });
            // 发送错误信息
            dataStream.writeData({
              type: 'error',
              content: `处理请求时出错: ${error instanceof Error ? error.message : '未知错误'}`,
            });
            // 确保流正确结束
            dataStream.writeData({
              type: 'done',
            });
          } catch (streamError) {
            console.error('[Canvas Mode] Failed to write error to stream:', streamError);
          }
          // 不抛出错误，让流正常结束
          return;
        }
      }

      // --- GENERAL 模式逻辑 (原有逻辑) ---
      // Initialize tools only when we have a Financial Datasets API key.
      const financialToolsManager =
        effectiveFinancialDatasetsApiKey && !isPlaceholderKey(effectiveFinancialDatasetsApiKey)
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
      const financialTools = financialToolsManager ? financialToolsManager.getTools() : {};
      const webSearchTools = webSearchToolsManager ? webSearchToolsManager.getTools() : {};
      
      // Filter out undefined values
      const allTools = Object.fromEntries(
        Object.entries({ ...financialTools, ...webSearchTools }).filter(([_, v]) => v !== undefined)
      ) as Record<string, any>;

      const result = streamText({
        model: customModel(model.apiIdentifier, effectiveModelApiKey!),
        tools: Object.keys(allTools).length > 0 ? allTools : undefined,
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
