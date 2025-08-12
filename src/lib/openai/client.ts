import OpenAI from 'openai'
import { openAIConfig } from './config'

let clientInstance: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!clientInstance) {
    clientInstance = new OpenAI({
      apiKey: openAIConfig.apiKey,
      organization: openAIConfig.organization,
    })
  }
  return clientInstance
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient()
  
  try {
    const response = await client.embeddings.create({
      model: openAIConfig.models.embedding,
      input: text,
      dimensions: openAIConfig.embeddings.dimensions,
    })
    
    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error('Failed to generate embedding')
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getOpenAIClient()
  
  try {
    const response = await client.embeddings.create({
      model: openAIConfig.models.embedding,
      input: texts,
      dimensions: openAIConfig.embeddings.dimensions,
    })
    
    return response.data.map(item => item.embedding)
  } catch (error) {
    console.error('Error generating embeddings:', error)
    throw new Error('Failed to generate embeddings')
  }
}