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
  // Token-based cost info for LLM operations (like summarization)
  estimatedInputTokens?: number;
  estimatedOutputTokens?: number;
}

export interface SystemConfig {
  watchDir: string;
  dbPath: string;
  redisHost: string;
  redisPort: number;
}

// NEW: Dynamic parser configuration for database storage
export interface ParserConfig {
  id: number;
  name: string;
  parserImplementation: string; // name of the parser implementation file to use
  displayName: string;
  description: string;
  inputExtensions: string[]; // file extensions
  inputTags: string[]; // required file tags
  outputExt: string;
  dependsOn: string[]; // other parser names
  isEnabled: boolean;
  allowUserSelection: boolean; // if true, user can manually select input files
  allowDerivedFiles: boolean; // if true, can process files that are outputs of other parsers
  config: Record<string, any>; // parser-specific configuration
  createdAt: number;
  updatedAt: number;
}

// NEW: File metadata and tagging
export interface FileTag {
  id: number;
  fileId: number;
  tag: string;
  value: string | null; // optional value for tag (e.g., "priority:high")
  createdAt: number;
}

export interface FileMetadata {
  id: number;
  fileId: number;
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
  createdAt: number;
  updatedAt: number;
}

// NEW: Enhanced file record with metadata
export interface FileRecordWithMetadata extends FileRecord {
  tags: FileTag[];
  metadata: FileMetadata[];
  category?: string;
  description?: string;
}

// NEW: Parser execution context with user selections
export interface ParserExecution {
  id: number;
  parserConfigId: number;
  fileIds: number[]; // files to process (for user-selected inputs)
  status: "pending" | "processing" | "done" | "failed";
  outputPaths: string[];
  error?: string;
  createdAt: number;
  updatedAt: number;
}
