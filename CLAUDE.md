# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Rime's Compendium" - a Quartz v4 static site generator project that publishes a digital garden of D&D campaign notes. The site contains session notes, character descriptions, locations, bestiary entries, and special items organized in a hierarchical folder structure.

## Commands

### Build and Development
- `npm run quartz` - Main CLI command for Quartz operations
- `npx quartz build` - Build the site for production
- `npx quartz build --serve` - Build and serve the site locally
- `npm run docs` - Build and serve documentation (alias for `npx quartz build --serve -d docs`)

### Code Quality
- `npm run check` - Run TypeScript type checking and Prettier format checking
- `npm run format` - Format code with Prettier
- `npm test` - Run tests using tsx test runner

### Transcription
- `npx quartz transcribe <file.mkv>` - Transcribe D&D session MKV recordings using OpenAI Whisper
- `npx quartz transcribe session-67.mkv --session 67 --date "2025-09-20"` - Transcribe with session metadata
- `npx quartz transcribe recording.mkv --enhance-discord --chunk-size 15` - Enhanced processing for Discord recordings

### Other Commands
- `npm run profile` - Profile build performance with 0x

## Architecture

### Core Structure
- **`quartz/`** - Contains the Quartz static site generator framework
  - `components/` - React/Preact components for UI elements (Header, Footer, Explorer, etc.)
  - `plugins/` - Content transformation and emission plugins
  - `transcribe/` - Audio transcription modules for D&D sessions
  - `build.ts` - Main build system logic
  - `cfg.ts` - Configuration types and utilities
  - `bootstrap-cli.mjs` - CLI entry point

### Content Organization
- **`content/`** - Markdown content files organized by category:
  - `Allies, NPCs, & Special Creatures/` - Character profiles and NPCs
  - `Bestiary/` - Monster and creature descriptions
  - `Chronicles/` - Story narratives
  - `Events/` - Campaign events
  - `Locations & Lore/` - World building content
  - `Session Notes/` - Game session summaries
  - `Special Items/` - Magical items and equipment

### Configuration Files
- **`quartz.config.ts`** - Main Quartz configuration defining plugins, transformers, and site settings
- **`quartz.layout.ts`** - Page layout configuration with custom Explorer filtering and emoji mapping for content categories
- **`package.json`** - Project dependencies and npm scripts

### Key Features
- **Custom Explorer Navigation**: Uses emoji mapping to categorize content types (🎭 for allies/NPCs, 🧟 for bestiary, etc.)
- **Plugin Pipeline**: Markdown processing with frontmatter, GitHub-flavored markdown, LaTeX support, and syntax highlighting
- **Multiple Page Types**: Content pages, folder indexes, and tag-based organization
- **Theme Customization**: Custom color scheme and typography configuration

### Content Processing Pipeline
1. **Transformers**: Process markdown content (frontmatter → syntax highlighting → Obsidian/GitHub markdown → table of contents → link crawling → LaTeX)
2. **Filters**: Remove draft content
3. **Emitters**: Generate final site assets (pages, folders, tags, search index, RSS, sitemap)

### Transcription System
- **Audio Processing**: FFmpeg-based MKV extraction with Discord-optimized enhancements
- **OpenAI Whisper Integration**: Automatic speech-to-text with chunking support for large files
- **Character Recognition**: Smart speaker identification for D&D characters (Thrall, Harold, The Soul Vessel members, Granite, Kara, Xune, DM, NPCs)
- **Output Format**: Structured markdown with timestamps and speaker attribution in `content/Session Notes/`
- **File Naming**: `Session X transcription.md` to separate from manual session notes

### Development Notes
- Built on Node.js 20+ and uses TypeScript
- Uses Preact for components instead of React
- Supports single-page application (SPA) mode with popovers enabled
- Custom theming with both light and dark mode support
- Analytics integration with Plausible
- Requires FFmpeg and OpenAI API key for transcription functionality