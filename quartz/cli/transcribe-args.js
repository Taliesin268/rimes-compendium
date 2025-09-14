export const TranscribeArgv = {
  file: {
    alias: "f",
    describe: "Path to the MKV file to transcribe",
    type: "string",
    demandOption: true,
  },
  session: {
    alias: "s",
    describe: "Session number",
    type: "number",
  },
  date: {
    alias: "d",
    describe: "Session date (YYYY-MM-DD format)",
    type: "string",
  },
  output: {
    alias: "o",
    describe: "Output filename (will be placed in content/Session Notes/)",
    type: "string",
  },
  "enhance-discord": {
    describe: "Apply Discord-specific audio enhancements",
    type: "boolean",
    default: true,
  },
  "chunk-size": {
    describe: "Chunk size in minutes for large files",
    type: "number",
    default: 10,
  },
  "backend": {
    describe: "Transcription backend to use",
    type: "string",
    choices: ["api", "local"],
    default: "local",
  },
  "api-key": {
    describe: "OpenAI API key (can also use OPENAI_API_KEY env var) - required for API backend",
    type: "string",
  },
  "whisper-model": {
    describe: "Whisper model size (local backend only)",
    type: "string",
    choices: ["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"],
    default: "base",
  },
  "install-whisper": {
    describe: "Automatically install local Whisper if not found",
    type: "boolean",
    default: true,
  },
  "include-timestamps": {
    describe: "Include timestamps in the transcription",
    type: "boolean",
    default: true,
  },
  "group-speakers": {
    describe: "Group consecutive segments by the same speaker",
    type: "boolean",
    default: true,
  },
  "mark-low-confidence": {
    describe: "Mark low-confidence transcription segments",
    type: "boolean",
    default: true,
  },
  "confidence-threshold": {
    describe: "Confidence threshold for marking segments (0.0-1.0)",
    type: "number",
    default: 0.6,
  },
  "keep-temp": {
    describe: "Keep temporary audio files after processing",
    type: "boolean",
    default: false,
  },
  verbose: {
    alias: "v",
    describe: "Verbose output",
    type: "boolean",
    default: false,
  },
}