export const runtime = 'nodejs';

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

export async function GET() {
  const hasOpenAIKey = !isPlaceholderKey(process.env.OPENAI_API_KEY);
  const hasFinancialDatasetsKey = !isPlaceholderKey(
    process.env.FINANCIAL_DATASETS_API_KEY,
  );

  return Response.json(
    {
      hasOpenAIKey,
      hasFinancialDatasetsKey,
    },
    { status: 200 },
  );
}

