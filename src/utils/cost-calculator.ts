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
