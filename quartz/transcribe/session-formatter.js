import { CharacterParser } from "./character-parser.js";
export class SessionFormatter {
    constructor() {
        this.parser = new CharacterParser();
    }
    formatTranscription(transcriptionResult, metadata, options = {}) {
        const opts = this.getDefaultOptions(options);
        let markdown = this.generateFrontmatter(metadata);
        markdown += this.generateHeader(metadata);
        if (opts.includeProcessingNotes && metadata.notes && metadata.notes.length > 0) {
            markdown += this.renderProcessingNotes(metadata.notes);
        }
        if (opts.disableSpeakerIdentification) {
            // Generate plain transcription without speaker identification
            if (transcriptionResult.segments && transcriptionResult.segments.length > 0) {
                markdown += this.generatePlainTranscriptionWithTimestamps(transcriptionResult.segments, opts);
            }
            else {
                markdown += this.generatePlainTranscription(transcriptionResult.text, opts);
            }
        }
        else if (transcriptionResult.segments && transcriptionResult.segments.length > 0) {
            const parsedSegments = transcriptionResult.segments.map(segment => this.parser.parseSegment(segment));
            const segments = opts.groupBySpeaker
                ? this.parser.groupSegmentsBySpeaker(parsedSegments)
                : parsedSegments;
            markdown += this.generateTranscriptionContent(segments, opts);
        }
        else {
            // Fallback for text-only transcription
            markdown += this.generateSimpleTranscription(transcriptionResult.text, opts);
        }
        markdown += this.generateFooter(metadata, opts);
        return markdown;
    }
    getDefaultOptions(options) {
        return {
            includeTimestamps: options.includeTimestamps ?? true,
            includeConfidenceMarkers: options.includeConfidenceMarkers ?? false,
            groupBySpeaker: options.groupBySpeaker ?? true,
            markLowConfidence: options.markLowConfidence ?? true,
            confidenceThreshold: options.confidenceThreshold ?? 0.6,
            includeProcessingNotes: options.includeProcessingNotes ?? true,
            disableSpeakerIdentification: options.disableSpeakerIdentification ?? true,
        };
    }
    generateFrontmatter(metadata) {
        const frontmatter = [
            "---",
            `session: ${metadata.sessionNumber || "unknown"}`,
            `date: ${metadata.date || "unknown"}`,
        ];
        if (metadata.duration) {
            frontmatter.push(`duration: "${metadata.duration}"`);
        }
        frontmatter.push(`processing_date: ${metadata.processingDate}`);
        if (metadata.audioQuality) {
            frontmatter.push(`audio_quality: ${metadata.audioQuality}`);
        }
        frontmatter.push("transcription: true");
        frontmatter.push("---");
        frontmatter.push("");
        return frontmatter.join("\n");
    }
    generateHeader(metadata) {
        let header = `# Session ${metadata.sessionNumber || "Unknown"} Transcription\n\n`;
        if (metadata.date && metadata.date !== "unknown") {
            header += `**Date:** ${this.formatDate(metadata.date)}\n`;
        }
        if (metadata.duration) {
            header += `**Duration:** ${metadata.duration}\n`;
        }
        header += `**Processed:** ${this.formatDate(metadata.processingDate)}\n\n`;
        if (metadata.audioQuality) {
            const qualityIcon = this.getQualityIcon(metadata.audioQuality);
            header += `**Audio Quality:** ${qualityIcon} ${metadata.audioQuality.charAt(0).toUpperCase() + metadata.audioQuality.slice(1)}\n\n`;
        }
        header += "---\n\n";
        return header;
    }
    renderProcessingNotes(notes) {
        let notesSection = "## Processing Notes\n\n";
        for (const note of notes) {
            notesSection += `- ${note}\n`;
        }
        notesSection += "\n---\n\n";
        return notesSection;
    }
    generateTranscriptionContent(segments, options) {
        let content = "## Transcription\n\n";
        let currentTimePeriod = "";
        for (const segment of segments) {
            // Add time period headers for better organization
            const timePeriod = this.getTimePeriod(segment.startTime);
            if (timePeriod !== currentTimePeriod) {
                currentTimePeriod = timePeriod;
                content += `### ${timePeriod}\n\n`;
            }
            // Format the segment
            content += this.formatSegment(segment, options) + "\n\n";
        }
        return content;
    }
    formatSegment(segment, options) {
        let segmentText = "";
        // Add timestamp if requested
        if (options.includeTimestamps) {
            segmentText += `### [${segment.timestamp}]\n`;
        }
        // Add speaker and text
        let speakerText = `**${segment.speaker}**: `;
        // Add confidence markers for unknown speakers
        if (options.includeConfidenceMarkers && segment.confidence < options.confidenceThreshold) {
            speakerText = `**${segment.speaker}** *(${Math.round(segment.confidence * 100)}%)*: `;
        }
        let text = segment.text;
        // Mark low confidence text
        if (options.markLowConfidence && segment.confidence < options.confidenceThreshold) {
            text = `*[Low confidence: ${text}]*`;
        }
        // Handle empty or unclear text
        if (!text || text.trim().length === 0) {
            text = "*[unclear audio]*";
        }
        segmentText += speakerText + text;
        return segmentText;
    }
    generateSimpleTranscription(text, options) {
        let content = "## Transcription\n\n";
        // Split text into paragraphs and attempt basic speaker detection
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        for (const paragraph of paragraphs) {
            content += `**Unknown**: ${paragraph.trim()}\n\n`;
        }
        if (options.markLowConfidence) {
            content += "*Note: This transcription lacks speaker identification and timing information.*\n\n";
        }
        return content;
    }
    generatePlainTranscription(text, options) {
        let content = "## Transcription\n\n";
        // Split text into natural paragraphs
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        if (paragraphs.length === 0) {
            // If no paragraph breaks, split by sentences or use the full text
            const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
            if (sentences.length > 1) {
                for (const sentence of sentences) {
                    content += `${sentence.trim()}.\n\n`;
                }
            }
            else {
                content += `${text.trim()}\n\n`;
            }
        }
        else {
            for (const paragraph of paragraphs) {
                content += `${paragraph.trim()}\n\n`;
            }
        }
        return content;
    }
    generatePlainTranscriptionWithTimestamps(segments, options) {
        let content = "## Transcription\n\n";
        let currentTimePeriod = "";
        for (const segment of segments) {
            if (options.includeTimestamps) {
                // Add time period headers for better organization
                const timePeriod = this.getTimePeriod(segment.start);
                if (timePeriod !== currentTimePeriod) {
                    currentTimePeriod = timePeriod;
                    content += `### ${timePeriod}\n\n`;
                }
                // Format timestamp
                const timestamp = this.formatTimestamp(segment.start);
                content += `**[${timestamp}]** ${segment.text.trim()}\n\n`;
            }
            else {
                content += `${segment.text.trim()}\n\n`;
            }
        }
        return content;
    }
    generateFooter(metadata, options) {
        let footer = "---\n\n";
        footer += "## About This Transcription\n\n";
        footer += "This transcription was automatically generated using OpenAI Whisper.\n";
        if (options.disableSpeakerIdentification) {
            footer += "This is a plain transcript without speaker identification.\n\n";
        }
        else {
            footer += "Speaker identification is based on context analysis and may not be 100% accurate.\n\n";
        }
        if (options.markLowConfidence && !options.disableSpeakerIdentification) {
            footer += `Segments marked with low confidence (below ${Math.round(options.confidenceThreshold * 100)}%) should be reviewed manually.\n\n`;
        }
        footer += "*Please review and correct any errors before using for campaign notes.*\n";
        return footer;
    }
    getTimePeriod(startTimeSeconds) {
        const totalMinutes = Math.floor(startTimeSeconds / 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 0) {
            const period = Math.floor(totalMinutes / 30) * 30; // 30-minute periods
            const periodHours = Math.floor(period / 60);
            const periodMinutes = period % 60;
            if (periodHours > 0) {
                return `${periodHours}h ${periodMinutes.toString().padStart(2, "0")}m - ${periodHours}h ${(periodMinutes + 30).toString().padStart(2, "0")}m`;
            }
            else {
                return `${periodMinutes}m - ${periodMinutes + 30}m`;
            }
        }
        else {
            const period = Math.floor(minutes / 15) * 15; // 15-minute periods for shorter sessions
            return `${period}m - ${period + 15}m`;
        }
    }
    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long"
            });
        }
        catch {
            return dateString;
        }
    }
    getQualityIcon(quality) {
        switch (quality) {
            case "good": return "🟢";
            case "fair": return "🟡";
            case "poor": return "🔴";
            default: return "⚫";
        }
    }
    generateFilename(sessionNumber, date) {
        if (sessionNumber) {
            return `Session ${sessionNumber} transcription.md`;
        }
        else if (date) {
            const dateObj = new Date(date);
            const dateStr = dateObj.toISOString().split("T")[0];
            return `Session ${dateStr} transcription.md`;
        }
        else {
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:.]/g, "-").split("T")[0];
            return `Session ${timestamp} transcription.md`;
        }
    }
    // Utility method to assess audio quality based on transcription confidence
    assessAudioQuality(segments) {
        if (segments.length === 0)
            return "poor";
        const averageConfidence = segments.reduce((sum, seg) => sum + seg.confidence, 0) / segments.length;
        const lowConfidenceSegments = segments.filter(seg => seg.confidence < 0.5).length;
        const lowConfidenceRatio = lowConfidenceSegments / segments.length;
        if (averageConfidence > 0.8 && lowConfidenceRatio < 0.1) {
            return "good";
        }
        else if (averageConfidence > 0.6 && lowConfidenceRatio < 0.3) {
            return "fair";
        }
        else {
            return "poor";
        }
    }
    // Generate processing notes based on analysis
    generateProcessingNotes(audioFilePath, transcriptionResult, segments) {
        const notes = [];
        if (audioFilePath.includes("discord")) {
            notes.push("Audio source: Discord recording via OBS");
        }
        if (transcriptionResult.language && transcriptionResult.language !== "en") {
            notes.push(`Detected language: ${transcriptionResult.language}`);
        }
        if (segments) {
            const unknownSpeakerSegments = segments.filter(s => s.speaker === "Unknown").length;
            if (unknownSpeakerSegments > 0) {
                notes.push(`${unknownSpeakerSegments} segments with unidentified speakers`);
            }
            const lowConfidenceSegments = segments.filter(s => s.confidence < 0.5).length;
            if (lowConfidenceSegments > 0) {
                notes.push(`${lowConfidenceSegments} low-confidence segments requiring review`);
            }
        }
        return notes;
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
