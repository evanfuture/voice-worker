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
  approvalBatchId?: number; // Link to approval batch if job was approved
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

// NEW: System setting for queue mode and other global configuration
export interface SystemSetting {
  key: string;
  value: string;
  updatedAt: number;
}

// NEW: Approval batch for user-controlled processing
export interface ApprovalBatch {
  id: number;
  name: string;
  status: "pending" | "processing" | "completed" | "failed";
  userSelections: Record<string, any>; // JSON object of user selections
  totalEstimatedCost: number;
  actualCost: number;
  createdAt: number;
  updatedAt: number;
}

// NEW: Predicted job chain for a file
export interface PredictedJob {
  id: number;
  fileId: number;
  predictedChain: ProcessingStep[]; // Array of predicted processing steps
  estimatedCosts: Record<string, number>; // Cost estimates for each step
  dependencies: string[]; // Array of parser dependencies
  isValid: boolean; // Whether the prediction is still valid
  createdAt: number;
  updatedAt: number;
}

// NEW: Individual processing step in a predicted chain
export interface ProcessingStep {
  parser: string;
  inputPath: string;
  outputPath: string;
  estimatedCost: number;
  dependsOn: string[];
}

// NEW: User selection for batch approval
export interface UserSelection {
  fileId: number;
  filePath: string;
  selectedSteps: string[]; // Array of parser names user wants to run
  totalCost: number;
}
