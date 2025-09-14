import OpenAI from "openai";
import { createReadStream } from "fs";
import { promises as fs } from "fs";
import chalk from "chalk";
export class WhisperClient {
    constructor(apiKey) {
        this.maxFileSize = 25 * 1024 * 1024; // 25MB limit for OpenAI
        this.client = new OpenAI({
            apiKey: apiKey || process.env.OPENAI_API_KEY,
        });
        if (!this.client.apiKey) {
            throw new Error("OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it directly.");
        }
    }
    async transcribeFile(audioFilePath, options = {}) {
        const fileStats = await fs.stat(audioFilePath);
        if (fileStats.size > this.maxFileSize) {
            throw new Error(`File size (${(fileStats.size / 1024 / 1024).toFixed(1)}MB) exceeds OpenAI's 25MB limit. Please use audio chunking.`);
        }
        console.log(chalk.blue(`Transcribing audio file (${(fileStats.size / 1024 / 1024).toFixed(1)}MB)...`));
        const audioFile = createReadStream(audioFilePath);
        try {
            const transcription = await this.client.audio.transcriptions.create({
                file: audioFile,
                model: options.model || "whisper-1",
                response_format: options.responseFormat || "verbose_json",
                temperature: options.temperature || 0,
                language: options.language,
                prompt: this.buildPrompt(options.prompt),
            });
            if (options.responseFormat === "text") {
                return {
                    text: transcription,
                };
            }
            const verboseResult = transcription;
            return {
                text: verboseResult.text,
                segments: verboseResult.segments,
                duration: verboseResult.duration,
                language: verboseResult.language,
            };
        }
        catch (error) {
            console.error(chalk.red("Transcription failed:"), error);
            throw error;
        }
    }
    async transcribeChunks(audioChunks, options = {}) {
        const results = [];
        console.log(chalk.blue(`Transcribing ${audioChunks.length} audio chunks...`));
        for (let i = 0; i < audioChunks.length; i++) {
            const chunk = audioChunks[i];
            console.log(chalk.grey(`Processing chunk ${i + 1}/${audioChunks.length}...`));
            try {
                const result = await this.transcribeFile(chunk, {
                    ...options,
                    prompt: this.buildContextualPrompt(options.prompt, results),
                });
                results.push(result);
                // Small delay to be respectful to the API
                if (i < audioChunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            catch (error) {
                console.error(chalk.red(`Failed to transcribe chunk ${i + 1}:`), error);
                // Continue with other chunks, but note the failure
                results.push({
                    text: `[TRANSCRIPTION FAILED FOR CHUNK ${i + 1}]`,
                });
            }
        }
        return results;
    }
    buildPrompt(userPrompt) {
        const basePrompt = `This is a transcription of a Dungeons & Dragons session recorded over Discord.
The session involves multiple players and a Dungeon Master (DM).
Player characters include: Thrall, Harold, The Soul Vessel (Ryn, Ron, Ronin, Rime, Ren, Rain), Granite, Kara, and Xune.
Please transcribe clearly, maintaining speaker context where possible.`;
        if (userPrompt) {
            return `${basePrompt}\n\nAdditional context: ${userPrompt}`;
        }
        return basePrompt;
    }
    buildContextualPrompt(userPrompt, previousResults) {
        let contextPrompt = this.buildPrompt(userPrompt);
        // Add context from previous chunks for better continuity
        if (previousResults.length > 0) {
            const lastResult = previousResults[previousResults.length - 1];
            const lastText = lastResult.text.slice(-200); // Last 200 characters for context
            contextPrompt += `\n\nPrevious context: ...${lastText}`;
        }
        return contextPrompt;
    }
    combineChunkResults(results) {
        const combinedText = results
            .map(result => result.text)
            .join(" ")
            .replace(/\s+/g, " ") // Normalize whitespace
            .trim();
        // Combine segments if available
        let combinedSegments = [];
        let timeOffset = 0;
        for (const result of results) {
            if (result.segments) {
                const adjustedSegments = result.segments.map(segment => ({
                    ...segment,
                    start: segment.start + timeOffset,
                    end: segment.end + timeOffset,
                }));
                combinedSegments.push(...adjustedSegments);
            }
            if (result.duration) {
                timeOffset += result.duration;
            }
        }
        return {
            text: combinedText,
            segments: combinedSegments.length > 0 ? combinedSegments : undefined,
            duration: timeOffset > 0 ? timeOffset : undefined,
            language: results.find(r => r.language)?.language,
        };
    }
    formatTimestamp(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
        else {
            return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
    }
}
