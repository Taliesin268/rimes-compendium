import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";
export class AudioProcessor {
    constructor(tempDir = "./quartz/.transcribe-cache") {
        this.tempDir = tempDir;
    }
    async ensureTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        }
        catch (error) {
            // Directory already exists or creation failed
        }
    }
    async validateMkvFile(filePath) {
        try {
            const stats = await fs.stat(filePath);
            if (!stats.isFile()) {
                throw new Error("Path is not a file");
            }
            const ext = path.extname(filePath).toLowerCase();
            if (ext !== ".mkv") {
                throw new Error("File is not an MKV file");
            }
            return true;
        }
        catch (error) {
            console.error(chalk.red(`File validation failed: ${error}`));
            return false;
        }
    }
    async extractAudioFromMkv(mkvPath, options = {}) {
        await this.ensureTempDir();
        const outputFormat = options.outputFormat || "wav";
        const outputPath = path.join(this.tempDir, `extracted_audio_${Date.now()}.${outputFormat}`);
        console.log(chalk.blue("Extracting audio from MKV..."));
        return new Promise((resolve, reject) => {
            let command = ffmpeg(mkvPath)
                .audioCodec(outputFormat === "wav" ? "pcm_s16le" : "mp3")
                .audioFrequency(16000) // Optimal for Whisper
                .audioChannels(1) // Mono for better transcription
                .format(outputFormat);
            // Discord-specific audio enhancements
            if (options.enhanceDiscord) {
                command = this.applyDiscordEnhancements(command);
            }
            command
                .on("start", (commandLine) => {
                console.log(chalk.grey(`FFmpeg command: ${commandLine}`));
            })
                .on("progress", (progress) => {
                if (progress.percent) {
                    process.stdout.write(`\r${chalk.blue("Processing:")} ${progress.percent.toFixed(1)}%`);
                }
            })
                .on("end", async () => {
                console.log(chalk.green("\nAudio extraction completed"));
                try {
                    const audioInfo = await this.getAudioInfo(outputPath);
                    resolve({
                        path: outputPath,
                        duration: audioInfo.duration,
                        format: outputFormat,
                        sampleRate: audioInfo.sampleRate,
                        channels: audioInfo.channels,
                        bitrate: audioInfo.bitrate,
                    });
                }
                catch (error) {
                    reject(error);
                }
            })
                .on("error", (error) => {
                console.error(chalk.red(`\nFFmpeg error: ${error.message}`));
                reject(error);
            })
                .save(outputPath);
        });
    }
    applyDiscordEnhancements(command) {
        return command
            .audioFilters([
            // High-pass filter to remove low-frequency noise
            "highpass=f=80",
            // Noise gate to reduce Discord artifacts
            "agate=threshold=0.003:ratio=2:attack=20:release=50",
            // Audio normalization
            "dynaudnorm=framelen=500:gausssize=31:peak=0.95",
            // Compression to even out volume differences
            "acompressor=threshold=0.5:ratio=2:attack=20:release=100",
            // De-esser to reduce harsh sibilants
            "deesser",
        ])
            .audioCodec("pcm_s16le"); // Ensure high quality
    }
    async getAudioInfo(audioPath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(audioPath, (error, metadata) => {
                if (error) {
                    reject(error);
                    return;
                }
                const audioStream = metadata.streams.find((stream) => stream.codec_type === "audio");
                if (!audioStream) {
                    reject(new Error("No audio stream found"));
                    return;
                }
                resolve({
                    duration: metadata.format.duration || 0,
                    sampleRate: audioStream.sample_rate || 16000,
                    channels: audioStream.channels || 1,
                    bitrate: audioStream.bit_rate,
                });
            });
        });
    }
    async splitAudioIntoChunks(audioPath, chunkDurationMinutes = 10) {
        const chunkPaths = [];
        const audioInfo = await this.getAudioInfo(audioPath);
        const totalDuration = audioInfo.duration;
        const chunkDuration = chunkDurationMinutes * 60; // Convert to seconds
        if (totalDuration <= chunkDuration) {
            // No need to split
            return [audioPath];
        }
        console.log(chalk.blue(`Splitting audio into ${Math.ceil(totalDuration / chunkDuration)} chunks...`));
        for (let start = 0; start < totalDuration; start += chunkDuration) {
            const chunkIndex = Math.floor(start / chunkDuration);
            const chunkPath = path.join(this.tempDir, `chunk_${chunkIndex}_${Date.now()}.wav`);
            await new Promise((resolve, reject) => {
                ffmpeg(audioPath)
                    .seekInput(start)
                    .duration(Math.min(chunkDuration, totalDuration - start))
                    .output(chunkPath)
                    .on("end", () => {
                    chunkPaths.push(chunkPath);
                    resolve();
                })
                    .on("error", reject)
                    .run();
            });
        }
        console.log(chalk.green(`Created ${chunkPaths.length} audio chunks`));
        return chunkPaths;
    }
    async cleanup(filePaths) {
        for (const filePath of filePaths) {
            try {
                await fs.unlink(filePath);
            }
            catch (error) {
                console.warn(chalk.yellow(`Failed to cleanup file: ${filePath}`));
            }
        }
    }
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        else {
            return `${secs}s`;
        }
    }
}
