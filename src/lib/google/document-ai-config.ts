// Parse credentials from base64 environment variable if available
let credentials: any = null;
if (process.env.GCP_CREDENTIALS_BASE64) {
  try {
    credentials = JSON.parse(
      Buffer.from(process.env.GCP_CREDENTIALS_BASE64, 'base64').toString()
    );
  } catch (error) {
    console.error('Failed to parse GCP credentials from base64:', error);
  }
}

export const documentAIConfig = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID!,
  projectNumber: process.env.GOOGLE_CLOUD_PROJECT_NUMBER!,
  location: process.env.GCP_LOCATION || 'us',
  processors: {
    ocr: process.env.GCP_OCR_PROCESSOR_ID!,
    formParser: process.env.GCP_FORM_PARSER_PROCESSOR_ID!,
    layoutParser: process.env.GCP_LAYOUT_PARSER_PROCESSOR_ID!,
    summarizer: process.env.GCP_SUMMARIZER_PROCESSOR_ID!,
  },
  credentials: credentials,
  // Fallback to file if no base64 credentials (for local dev)
  keyFilename: credentials ? undefined : process.env.GOOGLE_APPLICATION_CREDENTIALS,
}

export function getProcessorPath(processorId: string): string {
  return `projects/${documentAIConfig.projectNumber}/locations/${documentAIConfig.location}/processors/${processorId}`
}

export enum ProcessorType {
  OCR = 'ocr',
  FORM_PARSER = 'formParser',
  LAYOUT_PARSER = 'layoutParser',
  SUMMARIZER = 'summarizer'
}