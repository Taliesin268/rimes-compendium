# Quartz D&D Session Transcription

A comprehensive audio transcription system built for D&D campaigns, specifically designed to process Discord recordings captured via OBS and convert them into structured markdown files using OpenAI Whisper.

## Overview

This transcription system takes MKV video files (typically Discord recordings from D&D sessions) and produces clean, organized markdown transcriptions with:

- **Plain Text Transcription**: Clean transcripts without speaker identification (more reliable)
- **Discord Audio Enhancement**: Optimized processing for Discord voice chat recordings
- **Structured Output**: Timestamped transcriptions formatted for campaign notes
- **Large File Support**: Automatic chunking for long session recordings

## Prerequisites

### Required Software
1. **FFmpeg**: For audio extraction and processing
   ```bash
   # macOS (with Homebrew)
   brew install ffmpeg

   # Windows (with Chocolatey)
   choco install ffmpeg

   # Linux (Ubuntu/Debian)
   sudo apt update && sudo apt install ffmpeg
   ```

2. **Node.js 20+**: Required for the Quartz framework

3. **Python 3.8+**: Required for local Whisper (recommended)
   ```bash
   # Check Python version
   python3 --version

   # Install if needed (macOS with Homebrew)
   brew install python

   # Windows: Download from python.org
   # Linux: Usually pre-installed
   ```

4. **Transcription Backend** (choose one):
   - **Local Whisper** (recommended, free): `pip install openai-whisper`
   - **OpenAI API** (paid): Requires API key

### Required Dependencies
```bash
npm install
```

This installs:
- `openai` - OpenAI API client for Whisper
- `fluent-ffmpeg` - FFmpeg wrapper for audio processing
- `@types/fluent-ffmpeg` - TypeScript definitions

## Setup

### 1. Choose Your Backend

#### Option A: Local Whisper (Recommended - Free)
```bash
# Install OpenAI Whisper
pip install openai-whisper

# Verify installation
python3 -c "import whisper; print('Whisper installed successfully')"
```

#### Option B: OpenAI API (Paid)
```bash
# Set API key
export OPENAI_API_KEY=your_openai_api_key_here

# Or create .env file
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
```

### 2. Verify Installation
```bash
# Test FFmpeg installation
ffmpeg -version

# Test Python and Whisper (local backend)
python3 -c "import whisper; print('Ready for local transcription')"

# Test transcription system
npx quartz transcribe --help
```

### 3. Model Download (Local Whisper Only)
On first use, Whisper will download the model:
- **tiny**: ~39 MB (fastest, lowest accuracy)
- **base**: ~74 MB (good balance, default)
- **small**: ~244 MB (better accuracy)
- **medium**: ~769 MB (high accuracy)
- **large**: ~1550 MB (best accuracy)

## Usage

### Basic Transcription
```bash
# Local Whisper (default, free)
npx quartz transcribe path/to/session-recording.mkv

# OpenAI API (paid)
npx quartz transcribe recording.mkv --backend api
```

### With Session Metadata
```bash
npx quartz transcribe session-67.mkv --session 67 --date "2025-09-20"
```

### Backend-Specific Options
```bash
# Local Whisper with specific model
npx quartz transcribe recording.mkv --whisper-model medium

# Auto-install Whisper if missing
npx quartz transcribe recording.mkv --install-whisper

# OpenAI API with custom key
npx quartz transcribe recording.mkv --backend api --api-key sk-...
```

### Advanced Options
```bash
npx quartz transcribe recording.mkv \
  --session 67 \
  --date "2025-09-20" \
  --backend local \
  --whisper-model small \
  --enhance-discord \
  --chunk-size 15 \
  --mark-low-confidence \
  --verbose
```

## Command Line Options

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--file` | `-f` | - | Path to MKV file (required) |
| `--backend` | - | `local` | Transcription backend (`local` or `api`) |
| `--session` | `-s` | - | Session number |
| `--date` | `-d` | today | Session date (YYYY-MM-DD) |
| `--output` | `-o` | auto | Custom output filename |
| `--enhance-discord` | - | `true` | Apply Discord audio enhancements |
| `--chunk-size` | - | `10` | Chunk size in minutes for large files |
| `--whisper-model` | - | `base` | Local Whisper model (tiny/base/small/medium/large) |
| `--install-whisper` | - | `true` | Auto-install Whisper if missing |
| `--api-key` | - | env | OpenAI API key (API backend only) |
| `--include-timestamps` | - | `true` | Include timestamps in output |
| `--disable-speaker-id` | - | `true` | Disable speaker identification (plain transcript) |
| `--mark-low-confidence` | - | `true` | Mark uncertain transcriptions |
| `--confidence-threshold` | - | `0.6` | Confidence threshold (0.0-1.0) |
| `--keep-temp` | - | `false` | Keep temporary audio files |
| `--verbose` | `-v` | `false` | Detailed logging |

## Transcription Output

By default, the system outputs plain transcripts without speaker identification for maximum reliability. This approach avoids incorrect speaker assignments that can occur with automated voice recognition.

### Plain Transcript Mode (Default)
- Clean, continuous transcript text
- Optional timestamps for navigation
- No speaker identification attempts
- Higher accuracy and reliability

### Legacy Speaker Recognition (Optional)
If you enable speaker identification (`--disable-speaker-id false`), the system attempts to identify:

**Player Characters**: Thrall, Harold, The Soul Vessel (Ryn, Ron, Ronin, Rime, Ren, Rain), Granite, Kara, Xune

**NPCs and DM**: DM narration, specific NPCs (C'cillian, Shallar, etc.)

*Note: Speaker identification is often inaccurate and is disabled by default.*

## Audio Processing Features

### Discord Optimization
When `--enhance-discord` is enabled (default), the system applies:
- High-pass filter (removes low-frequency noise)
- Noise gate (reduces Discord artifacts)
- Dynamic range normalization
- Audio compression (evens out volume differences)
- De-esser (reduces harsh sounds)

### File Size Handling
- **Small files** (< 25MB): Direct transcription
- **Large files**: Automatic chunking with contextual processing
- **Maximum support**: Up to 2GB MKV files

## Output Format

Transcriptions are saved as markdown files in `content/Session Notes/`:

```
content/Session Notes/
├── Session 67 in-session notes.md          # Your manual notes
├── Session 67 transcription.md             # Auto-generated transcription
└── Session 68 transcription.md
```

### Example Output Structure
```markdown
---
session: 67
date: 2025-09-20
duration: "3h 24m"
processing_date: 2025-09-20T15:30:00Z
audio_quality: good
transcription: true
---

# Session 67 Transcription

**Date:** Friday, September 20, 2025
**Duration:** 3h 24m
**Processed:** Friday, September 20, 2025
**Audio Quality:** 🟢 Good

---

## Processing Notes

- Audio source: Discord recording via OBS

---

## Transcription

### 0m - 15m

**[00:05:32]** We start our session at the Reath Feast and everyone is enjoying themselves. The festivities are in full swing with music and laughter echoing through the halls.

**[00:07:15]** Thrall is taken far enough away that he can't really hear the sounds of revelry anymore. The corridor stretches before him, dimly lit by flickering torches.

**[00:12:45]** Their name is Shallah, they will be pleased to meet you. She has been waiting in the chamber beyond the great doors.

---

## About This Transcription

This transcription was automatically generated using OpenAI Whisper.
This is a plain transcript without speaker identification.

*Please review and correct any errors before using for campaign notes.*
```

## Backend Comparison

| Feature | Local Whisper | OpenAI API |
|---------|---------------|------------|
| **Cost** | Free (after setup) | ~$0.006/minute |
| **Setup** | Python + pip install | API key only |
| **Privacy** | Complete offline | Audio sent to OpenAI |
| **Speed** | Depends on hardware | Fast (cloud processing) |
| **Accuracy** | Same models as API | Same models as local |
| **Model Choice** | All models available | Fixed latest model |
| **Internet** | Not required | Required |
| **Hardware** | Uses local CPU/GPU | No local processing |

### Recommendations
- **Local Whisper**: Best for privacy, cost, and offline use
- **OpenAI API**: Best for convenience and if you already have credits

## Troubleshooting

### Common Issues

#### FFmpeg Not Found
```
Error: FFmpeg is not installed or not available in PATH
```
**Solution**: Install FFmpeg and ensure it's in your system PATH.

#### Python/Whisper Not Found (Local Backend)
```
Error: Python is not available
Error: Whisper is not installed
```
**Solution**:
- Install Python 3.8+: Download from python.org
- Install Whisper: `pip install openai-whisper`
- Or use `--install-whisper` for automatic installation

#### OpenAI API Key Missing (API Backend)
```
Error: OpenAI API key is required
```
**Solution**: Set `OPENAI_API_KEY` environment variable or use `--api-key` flag, or switch to local backend with `--backend local`.

#### File Size Too Large (API Backend)
```
Error: File size exceeds OpenAI's 25MB limit
```
**Solution**: Use `--chunk-size` option or switch to local backend with `--backend local`.

#### Poor Audio Quality
```
Warning: Low confidence transcription detected
```
**Solution**:
- Use `--enhance-discord` for Discord recordings
- Check original audio quality
- Consider re-recording with better audio settings

### Performance Tips

1. **For Long Sessions**: Use `--chunk-size 15` for 15-minute segments
2. **For Poor Audio**: Enable `--enhance-discord` and lower `--confidence-threshold`
3. **For Quick Processing**: Disable `--include-timestamps` if not needed
4. **For Review**: Use `--mark-low-confidence` to identify sections needing manual correction
5. **Local Performance**:
   - Use `--whisper-model tiny` for fastest processing
   - Use `--whisper-model large` for best accuracy (requires more RAM)
   - Models are cached after first download

### File Management

- **Temporary files** are automatically cleaned up unless `--keep-temp` is used
- **Cache directory**: `quartz/.transcribe-cache/`
- **Backup**: Original MKV files are never modified

## Integration with Quartz

Transcription files integrate seamlessly with your Quartz site:
- Automatic frontmatter for proper categorization
- Timestamps for easy navigation
- Speaker attribution for campaign reference
- Markdown formatting compatible with existing content

## Usage Costs

### Local Whisper (Recommended)
- **Cost**: Free after setup
- **Hardware Requirements**:
  - Minimum: 4GB RAM for tiny/base models
  - Recommended: 8GB+ RAM for small/medium models
  - Best: 16GB+ RAM for large models
- **Storage**: Models cache locally (39MB - 1550MB)

### OpenAI API
- **Cost**: $0.006 per minute of audio
- **Rate Limits**: Respects OpenAI rate limits with automatic delays
- **File Limits**: 25MB per API call (handled automatically via chunking)

### Cost Examples (API Only)
- 2-hour session: ~$0.72
- 4-hour session: ~$1.44
- Monthly (16 hours): ~$5.76

## Development

### Module Structure
```
quartz/transcribe/
├── README.md                 # This documentation
├── audio-processor.ts        # MKV processing and Discord enhancement
├── whisper-client.ts         # OpenAI Whisper API integration
├── character-parser.ts       # D&D character recognition
├── session-formatter.ts      # Markdown output formatting
└── file-utils.ts            # File validation and utilities
```

### Adding New Characters (Legacy Feature)
If using speaker identification (`--disable-speaker-id false`), you can add new character recognition by editing `character-parser.ts`:

```typescript
private readonly playerCharacters = new Map([
  ["new_character", ["new_character", "nickname", "variant"]],
  // ... existing characters
])
```

*Note: Plain transcript mode (default) does not use character recognition.*

### Custom Audio Processing
Modify `audio-processor.ts` to adjust Discord enhancement filters:

```typescript
.audioFilters([
  "highpass=f=80",              // Adjust frequency cutoff
  "agate=threshold=0.003",      // Adjust noise gate
  "dynaudnorm=peak=0.95",       // Adjust normalization
  // Add custom filters here
])
```

## Support and Contributing

- **Issues**: Report problems via GitHub issues
- **Features**: Submit feature requests for D&D-specific functionality
- **Documentation**: Help improve this README and inline documentation

For more information about the Quartz framework, see the main project documentation.