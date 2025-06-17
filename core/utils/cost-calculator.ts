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

// Current pricing as of June 11, 2025 (Updated with latest OpenAI announcements)
export const LLM_SERVICES: { [serviceName: string]: LLMServiceConfig } = {
  openai: {
    name: "OpenAI",
    models: {
      "whisper-1": {
        pricePerMinute: 0.006, // $0.006 per minute (rounded to the nearest second)
        description: "Whisper ASR model for audio transcription",
      },
      // O3 Series (June 10, 2025 - Major price reduction)
      o3: {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description:
          "O3 reasoning model - 80% cheaper than original launch price",
      },
      "o3-pro": {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description:
          "O3-Pro reasoning model with enhanced compute - 87% cheaper than o1-pro",
      },
      "o3-mini": {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description:
          "O3-Mini fast, cost-efficient reasoning model for coding, math, and science",
      },
      // GPT-4.1 Series (Released April 14, 2025)
      "gpt-4.1": {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description:
          "GPT-4.1 with 1M context window, advanced coding and instruction following",
      },
      "gpt-4.1-mini": {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description: "GPT-4.1 Mini - balanced performance and cost efficiency",
      },
      "gpt-4.1-nano": {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description: "GPT-4.1 Nano - fastest and most cost-effective variant",
      },
      // GPT-4o Series
      "gpt-4o": {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description: "GPT-4o multimodal model with vision capabilities",
      },
      "gpt-4o-mini": {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description: "GPT-4o Mini - cost-efficient with vision capabilities",
      },
      // O4-mini
      "o4-mini": {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description:
          "O4-Mini compact reasoning model, competitive with o3-mini",
      },
      // Image Generation
      "gpt-image-1": {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description:
          "GPT-Image-1 for enhanced image generation with better instruction following",
      },
      // Legacy models
      "gpt-4-turbo": {
        pricePerMinute: 0.0, // Token-based pricing, calculated separately
        description:
          "Legacy GPT-4 Turbo model for text generation and analysis",
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
 * Calculates cost for GPT models based on input and output tokens
 * Pricing as of June 11, 2025 - Updated with latest official OpenAI rates
 */
export function calculateGPTCost(
  inputTokens: number,
  outputTokens: number,
  model: string = "gpt-4o"
): { inputCost: number; outputCost: number; totalCost: number } {
  let inputPrice: number;
  let outputPrice: number;

  switch (model) {
    // O3 Series (June 10, 2025 - 80% price reduction)
    case "o3":
      inputPrice = 2.0 / 1000000; // $2.00 per 1M tokens (reduced by 80%)
      outputPrice = 8.0 / 1000000; // $8.00 per 1M tokens (reduced by 80%)
      break;
    case "o3-pro":
      inputPrice = 20.0 / 1000000; // $20.00 per 1M tokens (87% cheaper than o1-pro)
      outputPrice = 80.0 / 1000000; // $80.00 per 1M tokens
      break;
    case "o3-mini":
      inputPrice = 0.2 / 1000000; // $0.20 per 1M tokens (estimated based on community discussion)
      outputPrice = 0.8 / 1000000; // $0.80 per 1M tokens (estimated)
      break;

    // GPT-4.1 Series (Released April 14, 2025)
    case "gpt-4.1":
      inputPrice = 2.0 / 1000000; // $2.00 per 1M tokens
      outputPrice = 8.0 / 1000000; // $8.00 per 1M tokens
      break;
    case "gpt-4.1-mini":
      inputPrice = 0.4 / 1000000; // $0.40 per 1M tokens
      outputPrice = 1.6 / 1000000; // $1.60 per 1M tokens
      break;
    case "gpt-4.1-nano":
      inputPrice = 0.1 / 1000000; // $0.10 per 1M tokens
      outputPrice = 0.4 / 1000000; // $0.40 per 1M tokens
      break;

    // GPT-4o Series (Current as of June 2025)
    case "gpt-4o":
      inputPrice = 2.5 / 1000000; // $2.50 per 1M tokens (estimated current rate)
      outputPrice = 10.0 / 1000000; // $10.00 per 1M tokens (estimated current rate)
      break;
    case "gpt-4o-mini":
      inputPrice = 0.15 / 1000000; // $0.15 per 1M tokens (estimated current rate)
      outputPrice = 0.6 / 1000000; // $0.60 per 1M tokens (estimated current rate)
      break;

    // O4-mini (Competitive with o3-mini pricing)
    case "o4-mini":
      inputPrice = 0.2 / 1000000; // $0.20 per 1M tokens (same as o3-mini based on community discussion)
      outputPrice = 0.8 / 1000000; // $0.80 per 1M tokens
      break;

    // Legacy models for backwards compatibility
    case "gpt-4-turbo":
      inputPrice = 0.01 / 1000; // $0.01 per 1K tokens
      outputPrice = 0.03 / 1000; // $0.03 per 1K tokens
      break;
    case "gpt-4":
      inputPrice = 0.03 / 1000; // $0.03 per 1K tokens
      outputPrice = 0.06 / 1000; // $0.06 per 1K tokens
      break;

    default:
      throw new Error(
        `Unknown model: ${model}. Supported models: o3, o3-pro, o3-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4o, gpt-4o-mini, o4-mini, gpt-4-turbo, gpt-4`
      );
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

/**
 * Calculates cost for vision models based on image and text tokens
 * Based on June 2025 pricing for vision-enabled models
 */
export function calculateVisionCost(
  textInputTokens: number,
  imageInputTokens: number,
  outputTokens: number,
  model: string = "gpt-4o"
): {
  textInputCost: number;
  imageInputCost: number;
  outputCost: number;
  totalCost: number;
} {
  let textInputPrice: number;
  let imageInputPrice: number;
  let outputPrice: number;

  switch (model) {
    case "gpt-4o":
      textInputPrice = 2.5 / 1000000;
      imageInputPrice = 7.65 / 1000000; // Vision tokens are typically 3x text tokens
      outputPrice = 10.0 / 1000000;
      break;
    case "gpt-4o-mini":
      textInputPrice = 0.15 / 1000000;
      imageInputPrice = 0.33 / 1000000; // Approximate based on pattern
      outputPrice = 0.6 / 1000000;
      break;
    case "gpt-4.1":
      textInputPrice = 2.0 / 1000000;
      imageInputPrice = 3.0 / 1000000; // Based on community data showing improved vision efficiency
      outputPrice = 8.0 / 1000000;
      break;
    case "gpt-4.1-mini":
      textInputPrice = 0.4 / 1000000;
      imageInputPrice = 0.66 / 1000000;
      outputPrice = 1.6 / 1000000;
      break;
    case "o3":
      textInputPrice = 2.0 / 1000000;
      imageInputPrice = 6.75 / 1000000; // Based on community forum data
      outputPrice = 8.0 / 1000000;
      break;
    case "gpt-image-1":
      // GPT-Image-1 has special token-based pricing for image generation
      textInputPrice = 5.0 / 1000000; // Text tokens
      imageInputPrice = 10.0 / 1000000; // Image input tokens
      outputPrice = 40.0 / 1000000; // Image output tokens (much higher for generation)
      break;
    default:
      throw new Error(
        `Unknown vision model: ${model}. Supported models: gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, o3, gpt-image-1`
      );
  }

  const textInputCost = textInputTokens * textInputPrice;
  const imageInputCost = imageInputTokens * imageInputPrice;
  const outputCost = outputTokens * outputPrice;
  const totalCost = textInputCost + imageInputCost + outputCost;

  return {
    textInputCost: Math.round(textInputCost * 10000) / 10000,
    imageInputCost: Math.round(imageInputCost * 10000) / 10000,
    outputCost: Math.round(outputCost * 10000) / 10000,
    totalCost: Math.round(totalCost * 10000) / 10000,
  };
}
