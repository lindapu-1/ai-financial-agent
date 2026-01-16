import { auth } from '@/app/(auth)/auth';
import { getSkillsByUserId, saveSkill } from '@/lib/db/queries';
import { SKILL_PROMPTS } from '@/lib/ai/prompts-canvas';
import { INVESTMENT_RESEARCH_SOP_PROMPT } from '@/lib/ai/prompts-investment-research';

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
      {
        id: crypto.randomUUID(),
        name: '投资研报撰写SOP',
        prompt: INVESTMENT_RESEARCH_SOP_PROMPT,
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
  } else {
    // 检查是否已有投资研报SOP技能，如果没有则添加
    const hasInvestmentResearchSkill = skills.some(skill => skill.name === '投资研报撰写SOP');
    if (!hasInvestmentResearchSkill) {
      await saveSkill({
        id: crypto.randomUUID(),
        name: '投资研报撰写SOP',
        prompt: INVESTMENT_RESEARCH_SOP_PROMPT,
        userId: session.user.id,
        isSystem: true,
      });
      // 重新获取技能列表
      skills = await getSkillsByUserId({ userId: session.user.id });
    }
  }

  return Response.json(skills);
}
