import { statSync } from "node:fs";

export interface CostCalculationResult {
  estimatedDurationMinutes: number;
  estimatedCost: number;
  service: string;
  model: string;
  pricePerMinute: number;
}

export interface LLMServiceConfig {
  name: string;
  models: {
    [modelName: string]: {
      pricePerMinute: number;
      description: string;
    };
  };
}

// Current pricing as of 2025 (confirmed from OpenAI)
export const LLM_SERVICES: { [serviceName: string]: LLMServiceConfig } = {
  openai: {
    name: "OpenAI",
    models: {
      "whisper-1": {
        pricePerMinute: 0.006, // $0.006 per minute (rounded to the nearest second)
        description: "Whisper ASR model for audio transcription",
      },
      "gpt-4-turbo": {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description: "GPT-4 Turbo model for text generation and analysis",
      },
    },
  },
  // Future services can be added here
  anthropic: {
    name: "Anthropic",
    models: {
      // Placeholder for future audio models
    },
  },
  azure: {
    name: "Azure Cognitive Services",
    models: {
      // Could add Azure Speech Services pricing
    },
  },
  google: {
    name: "Google Cloud",
    models: {
      // Could add Google Speech-to-Text pricing
    },
  },
};

/**
 * Estimates audio duration from file size using typical audio compression ratios
 * This is an approximation - real duration would require audio analysis
 */
export function estimateAudioDurationFromSize(fileSizeBytes: number): number {
  // Typical audio file size calculations:
  // MP3 128kbps: ~1MB per minute
  // MP3 320kbps: ~2.5MB per minute
  // WAV uncompressed: ~10MB per minute
  // M4A/AAC: ~1-2MB per minute

  // Using conservative estimate of 1.5MB per minute for mixed formats
  const averageMbPerMinute = 1.5;
  const fileSizeMB = fileSizeBytes / (1024 * 1024);
  const estimatedMinutes = fileSizeMB / averageMbPerMinute;

  return Math.max(0.1, estimatedMinutes); // Minimum 0.1 minutes (6 seconds)
}

/**
 * Calculates cost for transcription based on file size
 */
export function calculateTranscriptionCost(
  filePath: string,
  service: string = "openai",
  model: string = "whisper-1"
): CostCalculationResult {
  const serviceConfig = LLM_SERVICES[service];
  if (!serviceConfig) {
    throw new Error(`Unknown service: ${service}`);
  }

  const modelConfig = serviceConfig.models[model];
  if (!modelConfig) {
    throw new Error(`Unknown model ${model} for service ${service}`);
  }

  // Get file size
  const stats = statSync(filePath);
  const fileSizeBytes = stats.size;

  // Estimate duration
  const estimatedDurationMinutes = estimateAudioDurationFromSize(fileSizeBytes);

  // Calculate cost
  const estimatedCost = estimatedDurationMinutes * modelConfig.pricePerMinute;

  return {
    estimatedDurationMinutes: Math.round(estimatedDurationMinutes * 100) / 100, // Round to 2 decimal places
    estimatedCost: Math.round(estimatedCost * 10000) / 10000, // Round to 4 decimal places
    service: serviceConfig.name,
    model,
    pricePerMinute: modelConfig.pricePerMinute,
  };
}

/**
 * Calculates total cost for multiple files
 */
export function calculateBatchCost(
  filePaths: string[],
  service: string = "openai",
  model: string = "whisper-1"
): {
  totalCost: number;
  totalDurationMinutes: number;
  fileCount: number;
  individualCosts: CostCalculationResult[];
} {
  const individualCosts = filePaths.map((filePath) =>
    calculateTranscriptionCost(filePath, service, model)
  );

  const totalCost = individualCosts.reduce(
    (sum, cost) => sum + cost.estimatedCost,
    0
  );
  const totalDurationMinutes = individualCosts.reduce(
    (sum, cost) => sum + cost.estimatedDurationMinutes,
    0
  );

  return {
    totalCost: Math.round(totalCost * 10000) / 10000,
    totalDurationMinutes: Math.round(totalDurationMinutes * 100) / 100,
    fileCount: filePaths.length,
    individualCosts,
  };
}

/**
 * Formats cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(2)}¢`;
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Formats duration for display
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return `${Math.round(minutes * 60)}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Estimates token count for text (rough approximation: ~4 characters per token)
 */
export function estimateTokenCount(text: string): number {
  // Rough approximation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Calculates cost for GPT-4 based on input and output tokens
 * Pricing as of 2025: GPT-4 Turbo $0.01 per 1K input tokens, $0.03 per 1K output tokens
 */
export function calculateGPTCost(
  inputTokens: number,
  outputTokens: number,
  model: string = "gpt-4-turbo"
): { inputCost: number; outputCost: number; totalCost: number } {
  let inputPrice: number;
  let outputPrice: number;

  switch (model) {
    case "gpt-4-turbo":
      inputPrice = 0.01 / 1000; // $0.01 per 1K tokens
      outputPrice = 0.03 / 1000; // $0.03 per 1K tokens
      break;
    case "gpt-4":
      inputPrice = 0.03 / 1000; // $0.03 per 1K tokens
      outputPrice = 0.06 / 1000; // $0.06 per 1K tokens
      break;
    default:
      throw new Error(`Unknown GPT model: ${model}`);
  }

  const inputCost = inputTokens * inputPrice;
  const outputCost = outputTokens * outputPrice;
  const totalCost = inputCost + outputCost;

  return {
    inputCost: Math.round(inputCost * 10000) / 10000,
    outputCost: Math.round(outputCost * 10000) / 10000,
    totalCost: Math.round(totalCost * 10000) / 10000,
  };
}

/**
 * Estimates summarization cost based on input text length
 */
export function estimateSummarizationCost(
  inputText: string,
  model: string = "gpt-4-turbo"
): {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCost: number;
  service: string;
  model: string;
} {
  const inputTokens = estimateTokenCount(inputText);
  // Assume summary is roughly 20% of input length
  const outputTokens = Math.ceil(inputTokens * 0.2);

  const cost = calculateGPTCost(inputTokens, outputTokens, model);

  return {
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedCost: cost.totalCost,
    service: "OpenAI",
    model,
  };
}
