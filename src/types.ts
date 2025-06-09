export interface FileRecord {
  id: number;
  path: string;
  sha256: string;
  kind: "original" | "derivative";
  createdAt: number;
  updatedAt: number;
}

export interface ParseRecord {
  fileId: number;
  parser: string;
  status: "pending" | "processing" | "done" | "failed";
  outputPath: string | null;
  updatedAt: number;
  error?: string;
}

export interface Parser {
  name: string;
  input: string[]; // file extensions like ['.m4a', '.wav', '.mp3']
  outputExt: string;
  dependsOn: string[]; // other parser names that must complete first
  run(inputPath: string): Promise<string>; // returns output path
}

export interface JobData {
  path: string;
  parser: string;
  // Optional cost information (added for cost calculations)
  fileSizeBytes?: number;
  estimatedCost?: number;
  estimatedDurationMinutes?: number;
}

export interface SystemConfig {
  watchDir: string;
  dbPath: string;
  redisHost: string;
  redisPort: number;
}
