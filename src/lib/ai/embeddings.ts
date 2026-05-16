import { fetchWithRetry } from '@/lib/utils'

const EMBEDDING_MODEL = 'nomic-embed-text-v1_5'
const BATCH_SIZE = 20
const EMBEDDING_DIM = 768 // nomic-embed-text-v1_5 outputs 768 dims

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = []

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const batchEmbeddings = await embedBatch(batch)
    embeddings.push(...batchEmbeddings)
  }

  return embeddings
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await fetchWithRetry(
    'https://api.groq.com/openai/v1/embeddings',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
      }),
    },
    3
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Embedding API error: ${response.status} — ${error}`)
  }

  const data = await response.json()
  return data.data.map((d: { embedding: number[] }) => d.embedding)
}

export { EMBEDDING_DIM }
