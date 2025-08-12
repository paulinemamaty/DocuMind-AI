export const openAIConfig = {
  apiKey: process.env.OPENAI_API_KEY!,
  organization: process.env.OPENAI_ORG_ID,
  models: {
    chat: 'gpt-4-turbo-preview',
    embedding: 'text-embedding-3-small',
  },
  embeddings: {
    dimensions: 1536, // text-embedding-3-small dimension
    chunkSize: 1000,
    chunkOverlap: 200,
  },
  chat: {
    temperature: 0.7,
    maxTokens: 2000,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stream: true, // Enable streaming for better UX
  },
}

export const SYSTEM_PROMPT = `You are DocuMind AI, an intelligent document assistant. 
You help users understand and work with their documents by:
- Answering questions about document content
- Extracting specific information
- Summarizing key points
- Helping fill out forms
- Explaining complex terms or sections

Always provide accurate, helpful responses based on the document context provided.
When citing information, reference the specific section or page number.
If you're unsure about something, acknowledge the uncertainty rather than guessing.`