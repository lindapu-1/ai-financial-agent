import { auth } from '@/app/(auth)/auth';
import { getSkillsByUserId, saveSkill } from '@/lib/db/queries';
import { SKILL_PROMPTS } from '@/lib/ai/prompts-canvas';

export async function GET() {
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  let skills = await getSkillsByUserId({ userId: session.user.id });

  // 如果用户没有任何技能，自动初始化默认技能
  if (skills.length === 0) {
    const defaultSkills = [
      {
        id: crypto.randomUUID(),
        name: '行业情况分析',
        prompt: SKILL_PROMPTS.industry,
      },
      {
        id: crypto.randomUUID(),
        name: '技术壁垒解构',
        prompt: SKILL_PROMPTS.barrier,
      },
    ];

    for (const s of defaultSkills) {
      await saveSkill({
        id: s.id,
        name: s.name,
        prompt: s.prompt,
        userId: session.user.id,
        isSystem: true,
      });
    }

    // 重新获取已初始化的技能
    skills = await getSkillsByUserId({ userId: session.user.id });
  }

  return Response.json(skills);
}
