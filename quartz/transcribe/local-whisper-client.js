import { spawn, execSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import chalk from "chalk";
export class LocalWhisperClient {
    constructor() {
        this.pythonCommand = "python3";
        this.whisperInstalled = false;
        this.useVenv = false;
        this.detectPythonCommand();
    }
    detectPythonCommand() {
        // First try to detect virtual environment
        if (process.env.VIRTUAL_ENV) {
            this.venvPath = process.env.VIRTUAL_ENV;
            this.pythonCommand = path.join(process.env.VIRTUAL_ENV, "bin", "python");
            this.useVenv = true;
            console.log(chalk.blue(`Detected virtual environment: ${this.venvPath}`));
            return;
        }
        // Try different Python commands
        const pythonCommands = ["python3", "python", "py"];
        for (const cmd of pythonCommands) {
            try {
                execSync(`${cmd} --version`, { stdio: "ignore" });
                this.pythonCommand = cmd;
                break;
            }
            catch {
                continue;
            }
        }
    }
    async checkInstallation() {
        const errors = [];
        let pythonAvailable = false;
        let whisperInstalled = false;
        let ffmpegAvailable = false;
        // Check Python
        try {
            execSync(`${this.pythonCommand} --version`, { stdio: "ignore" });
            pythonAvailable = true;
        }
        catch {
            errors.push(`Python is not available. Please install Python 3.8+ and ensure it's in your PATH.`);
        }
        // Check FFmpeg
        try {
            execSync("ffmpeg -version", { stdio: "ignore" });
            ffmpegAvailable = true;
        }
        catch {
            errors.push("FFmpeg is not available. Please install FFmpeg and ensure it's in your PATH.");
        }
        // Check Whisper installation
        if (pythonAvailable) {
            try {
                execSync(`${this.pythonCommand} -c "import whisper"`, { stdio: "ignore" });
                whisperInstalled = true;
                this.whisperInstalled = true;
            }
            catch {
                errors.push("OpenAI Whisper is not installed. Run: pip install openai-whisper");
            }
        }
        return {
            pythonAvailable,
            whisperInstalled,
            ffmpegAvailable,
            errors
        };
    }
    async installWhisper() {
        console.log(chalk.blue("Installing OpenAI Whisper..."));
        try {
            const process = spawn(this.pythonCommand, ["-m", "pip", "install", "openai-whisper"], {
                stdio: "pipe"
            });
            process.stdout.on("data", (data) => {
                if (data.toString().includes("Successfully installed")) {
                    console.log(chalk.green(data.toString().trim()));
                }
            });
            process.stderr.on("data", (data) => {
                const message = data.toString().trim();
                if (!message.includes("WARNING")) {
                    console.log(chalk.grey(message));
                }
            });
            return new Promise((resolve) => {
                process.on("close", (code) => {
                    if (code === 0) {
                        console.log(chalk.green("Whisper installed successfully!"));
                        this.whisperInstalled = true;
                        resolve(true);
                    }
                    else {
                        console.error(chalk.red("Failed to install Whisper"));
                        resolve(false);
                    }
                });
            });
        }
        catch (error) {
            console.error(chalk.red(`Installation failed: ${error.message}`));
            return false;
        }
    }
    async listAvailableModels() {
        // Standard Whisper models
        return ["tiny", "base", "small", "medium", "large", "large-v2", "large-v3"];
    }
    async transcribeFile(audioFilePath, options = {}) {
        if (!this.whisperInstalled) {
            const installation = await this.checkInstallation();
            if (!installation.whisperInstalled) {
                throw new Error("Whisper is not installed. Run the installation check first.");
            }
        }
        const opts = this.getDefaultOptions(options);
        const outputPath = await this.createTempOutputPath();
        console.log(chalk.blue(`Transcribing with local Whisper (${opts.model} model)...`));
        const args = this.buildWhisperArgs(audioFilePath, outputPath, opts);
        try {
            await this.runWhisperCommand(args, opts.verbose);
            const result = await this.parseWhisperOutput(outputPath, opts.outputFormat, audioFilePath);
            // Cleanup temp files
            await this.cleanupTempFiles(outputPath);
            return result;
        }
        catch (error) {
            await this.cleanupTempFiles(outputPath);
            throw error;
        }
    }
    async transcribeChunks(audioChunks, options = {}) {
        const results = [];
        console.log(chalk.blue(`Transcribing ${audioChunks.length} chunks with local Whisper...`));
        for (let i = 0; i < audioChunks.length; i++) {
            const chunk = audioChunks[i];
            console.log(chalk.grey(`Processing chunk ${i + 1}/${audioChunks.length}...`));
            try {
                const result = await this.transcribeFile(chunk, {
                    ...options,
                    initialPrompt: this.buildContextualPrompt(options.initialPrompt, results)
                });
                results.push(result);
            }
            catch (error) {
                console.error(chalk.red(`Failed to transcribe chunk ${i + 1}: ${error.message}`));
                results.push({
                    text: `[LOCAL TRANSCRIPTION FAILED FOR CHUNK ${i + 1}]`
                });
            }
        }
        return results;
    }
    getDefaultOptions(options) {
        return {
            model: options.model || "base",
            language: options.language || "en",
            task: options.task || "transcribe",
            outputFormat: options.outputFormat || "json",
            temperature: options.temperature || 0,
            initialPrompt: options.initialPrompt || this.buildDefaultPrompt(),
            wordTimestamps: options.wordTimestamps ?? true,
            verbose: options.verbose ?? false
        };
    }
    buildWhisperArgs(inputPath, outputPath, options) {
        const args = [
            "-m", "whisper",
            inputPath,
            "--model", options.model,
            "--language", options.language,
            "--task", options.task,
            "--output_format", options.outputFormat,
            "--output_dir", path.dirname(outputPath)
        ];
        if (options.temperature > 0) {
            args.push("--temperature", options.temperature.toString());
        }
        if (options.initialPrompt) {
            args.push("--initial_prompt", options.initialPrompt);
        }
        if (options.wordTimestamps) {
            args.push("--word_timestamps", "True");
        }
        if (options.verbose) {
            args.push("--verbose", "True");
        }
        return args;
    }
    async runWhisperCommand(args, verbose) {
        return new Promise((resolve, reject) => {
            const process = spawn(this.pythonCommand, args, {
                stdio: verbose ? "inherit" : "pipe"
            });
            let stderr = "";
            if (!verbose) {
                process.stderr.on("data", (data) => {
                    stderr += data.toString();
                });
                process.stdout.on("data", (data) => {
                    const output = data.toString();
                    // Show progress information
                    if (output.includes("%") || output.includes("Processing")) {
                        process.stdout.write(`\r${chalk.blue("Progress:")} ${output.trim()}`);
                    }
                });
            }
            process.on("close", (code) => {
                if (code === 0) {
                    if (!verbose)
                        console.log(); // New line after progress
                    resolve();
                }
                else {
                    reject(new Error(`Whisper process failed with code ${code}: ${stderr}`));
                }
            });
            process.on("error", (error) => {
                reject(new Error(`Failed to start Whisper process: ${error.message}`));
            });
        });
    }
    async parseWhisperOutput(outputPath, format, originalInputPath) {
        const outputDir = path.dirname(outputPath);
        try {
            if (format === "json") {
                // Whisper CLI creates files based on input filename
                // If we have the original input path, use it to construct the expected output filename
                let jsonPath;
                if (originalInputPath) {
                    const inputBasename = path.basename(originalInputPath, path.extname(originalInputPath));
                    jsonPath = path.join(outputDir, `${inputBasename}.json`);
                    console.log(chalk.grey(`Looking for Whisper output: ${jsonPath}`));
                }
                else {
                    // Fallback: search for any JSON file
                    const files = await fs.readdir(outputDir);
                    const jsonFiles = files.filter(f => f.endsWith('.json'));
                    if (jsonFiles.length === 0) {
                        throw new Error("No JSON output file found");
                    }
                    jsonFiles.sort((a, b) => {
                        const aPath = path.join(outputDir, a);
                        const bPath = path.join(outputDir, b);
                        const aStat = require('fs').statSync(aPath);
                        const bStat = require('fs').statSync(bPath);
                        return bStat.mtime.getTime() - aStat.mtime.getTime();
                    });
                    jsonPath = path.join(outputDir, jsonFiles[0]);
                    console.log(chalk.grey(`Using most recent JSON file: ${jsonPath}`));
                }
                const jsonContent = await fs.readFile(jsonPath, "utf-8");
                const data = JSON.parse(jsonContent);
                return {
                    text: data.text || "",
                    segments: data.segments?.map((seg) => ({
                        id: seg.id,
                        seek: seg.seek,
                        start: seg.start,
                        end: seg.end,
                        text: seg.text,
                        tokens: seg.tokens || [],
                        temperature: seg.temperature || 0,
                        avg_logprob: seg.avg_logprob || 0,
                        compression_ratio: seg.compression_ratio || 0,
                        no_speech_prob: seg.no_speech_prob || 0
                    })),
                    duration: data.segments?.length > 0 ?
                        data.segments[data.segments.length - 1].end : undefined,
                    language: data.language
                };
            }
            else {
                // Similar logic for text files
                let txtPath;
                if (originalInputPath) {
                    const inputBasename = path.basename(originalInputPath, path.extname(originalInputPath));
                    txtPath = path.join(outputDir, `${inputBasename}.txt`);
                }
                else {
                    // Fallback: search for any TXT file
                    const files = await fs.readdir(outputDir);
                    const txtFiles = files.filter(f => f.endsWith('.txt'));
                    if (txtFiles.length === 0) {
                        throw new Error("No TXT output file found");
                    }
                    txtFiles.sort((a, b) => {
                        const aPath = path.join(outputDir, a);
                        const bPath = path.join(outputDir, b);
                        const aStat = require('fs').statSync(aPath);
                        const bStat = require('fs').statSync(bPath);
                        return bStat.mtime.getTime() - aStat.mtime.getTime();
                    });
                    txtPath = path.join(outputDir, txtFiles[0]);
                }
                const textContent = await fs.readFile(txtPath, "utf-8");
                return {
                    text: textContent.trim()
                };
            }
        }
        catch (error) {
            throw new Error(`Failed to parse Whisper output: ${error.message}`);
        }
    }
    async createTempOutputPath() {
        const tempDir = path.join(process.cwd(), "quartz", ".transcribe-cache");
        await fs.mkdir(tempDir, { recursive: true });
        return path.join(tempDir, `whisper_output_${Date.now()}`);
    }
    async cleanupTempFiles(basePath) {
        // Clean up all transcription files in the output directory
        const outputDir = path.dirname(basePath);
        const extensions = [".json", ".txt", ".vtt", ".srt"];
        try {
            const files = await fs.readdir(outputDir);
            for (const file of files) {
                const ext = path.extname(file);
                if (extensions.includes(ext)) {
                    try {
                        await fs.unlink(path.join(outputDir, file));
                        console.log(chalk.grey(`Cleaned up: ${file}`));
                    }
                    catch {
                        // File might be in use or already deleted, ignore error
                    }
                }
            }
        }
        catch {
            // Directory might not exist or be inaccessible, ignore
        }
    }
    buildDefaultPrompt() {
        return `This is a transcription of a Dungeons & Dragons session recorded over Discord. The session involves multiple players and a Dungeon Master (DM). Player characters include: Thrall, Harold, The Soul Vessel (Ryn, Ron, Ronin, Rime, Ren, Rain), Granite, Kara, and Xune. Please transcribe clearly, maintaining speaker context where possible.`;
    }
    buildContextualPrompt(userPrompt, previousResults = []) {
        let contextPrompt = userPrompt || this.buildDefaultPrompt();
        // Add context from previous chunks
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
            .replace(/\s+/g, " ")
            .trim();
        // Combine segments if available
        let combinedSegments = [];
        let timeOffset = 0;
        for (const result of results) {
            if (result.segments) {
                const adjustedSegments = result.segments.map(segment => ({
                    ...segment,
                    start: segment.start + timeOffset,
                    end: segment.end + timeOffset
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
            language: results.find(r => r.language)?.language
        };
    }
    getModelSizes() {
        return {
            "tiny": "~39 MB",
            "base": "~74 MB",
            "small": "~244 MB",
            "medium": "~769 MB",
            "large": "~1550 MB",
            "large-v2": "~1550 MB",
            "large-v3": "~1550 MB"
        };
    }
    getModelAccuracy() {
        return {
            "tiny": "Fastest, lowest accuracy",
            "base": "Good speed, basic accuracy",
            "small": "Balanced speed and accuracy",
            "medium": "Better accuracy, slower",
            "large": "Best accuracy, slowest",
            "large-v2": "Best accuracy, improved",
            "large-v3": "Latest, best overall"
        };
    }
}
