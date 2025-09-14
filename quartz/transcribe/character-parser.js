export class CharacterParser {
    constructor() {
        // Player character names and common variations
        this.playerCharacters = new Map([
            ["thrall", ["thrall", "thral", "thrael"]],
            ["harold", ["harold", "harold", "harold's", "harolds"]],
            ["ryn", ["ryn", "rin", "ryan"]],
            ["ron", ["ron", "ronald"]],
            ["ronin", ["ronin", "ronan", "ronnie"]],
            ["rime", ["rime", "rhyme", "ryme"]],
            ["ren", ["ren", "renn", "wren"]],
            ["rain", ["rain", "rayne", "reign"]],
            ["granite", ["granite", "granit", "grant"]],
            ["kara", ["kara", "cara", "kara's", "karas"]],
            ["xune", ["xune", "zoon", "zune"]],
        ]);
        // Common NPC names from the campaign
        this.commonNPCs = new Set([
            "c'cillian", "ccillian", "killian", "shallar", "shallah", "risen", "helios", "t'sheek", "tsheek",
            "ace", "chad johnson", "ferros ocham", "miss olfolk", "nebula", "ponyta", "serenity emelda",
            "thaea", "mion", "vuela",
        ]);
        // DM indicators
        this.dmIndicators = [
            "dm", "dungeon master", "narrator", "the dm", "game master", "gm",
        ];
        // Phrases that suggest character speech
        this.characterSpeechPatterns = [
            /^(.*?)\s*says?[:\s]/i,
            /^(.*?)\s*asks?[:\s]/i,
            /^(.*?)\s*responds?[:\s]/i,
            /^(.*?)\s*whispers?[:\s]/i,
            /^(.*?)\s*shouts?[:\s]/i,
            /^(.*?)\s*tells?[:\s]/i,
        ];
        // DM narration patterns
        this.dmNarrationPatterns = [
            /you see/i,
            /you hear/i,
            /you feel/i,
            /you notice/i,
            /roll for/i,
            /make a.*check/i,
            /as you.*enter/i,
            /the room/i,
            /suddenly/i,
            /meanwhile/i,
        ];
    }
    parseSegment(segment) {
        const text = segment.text.trim();
        const characterMatch = this.identifyCharacter(text);
        return {
            timestamp: this.formatTimestamp(segment.start),
            startTime: segment.start,
            endTime: segment.end,
            speaker: characterMatch.character,
            text: this.cleanTranscriptionText(text, characterMatch),
            confidence: characterMatch.confidence,
            originalText: text,
        };
    }
    identifyCharacter(text) {
        const lowerText = text.toLowerCase().trim();
        // Check for explicit character speech patterns first
        for (const pattern of this.characterSpeechPatterns) {
            const match = lowerText.match(pattern);
            if (match && match[1]) {
                const speakerName = match[1].trim();
                const characterMatch = this.matchCharacterName(speakerName);
                if (characterMatch.confidence > 0.7) {
                    return characterMatch;
                }
            }
        }
        // Check for DM indicators
        for (const indicator of this.dmIndicators) {
            if (lowerText.includes(indicator)) {
                return {
                    character: "DM",
                    confidence: 0.9,
                    type: "dm",
                };
            }
        }
        // Check for DM narration patterns
        for (const pattern of this.dmNarrationPatterns) {
            if (pattern.test(lowerText)) {
                return {
                    character: "DM",
                    confidence: 0.8,
                    type: "dm",
                };
            }
        }
        // Check for NPC names
        const npcMatch = this.findNPCInText(lowerText);
        if (npcMatch) {
            return {
                character: `DM (${npcMatch})`,
                confidence: 0.7,
                type: "npc",
            };
        }
        // Look for character names mentioned anywhere in the text
        const characterInText = this.findCharacterInText(lowerText);
        if (characterInText.confidence > 0.6) {
            return characterInText;
        }
        // Default to unknown with low confidence
        return {
            character: "Unknown",
            confidence: 0.1,
            type: "unknown",
        };
    }
    matchCharacterName(name) {
        const lowerName = name.toLowerCase().trim();
        // Direct player character match
        for (const [character, variations] of this.playerCharacters) {
            for (const variation of variations) {
                if (lowerName === variation || lowerName.includes(variation)) {
                    return {
                        character: this.capitalizeCharacterName(character),
                        confidence: 0.9,
                        type: "player",
                    };
                }
            }
        }
        // Fuzzy matching for character names
        for (const [character, variations] of this.playerCharacters) {
            for (const variation of variations) {
                if (this.fuzzyMatch(lowerName, variation)) {
                    return {
                        character: this.capitalizeCharacterName(character),
                        confidence: 0.7,
                        type: "player",
                    };
                }
            }
        }
        return {
            character: "Unknown",
            confidence: 0.1,
            type: "unknown",
        };
    }
    findCharacterInText(text) {
        let bestMatch = {
            character: "Unknown",
            confidence: 0.1,
            type: "unknown",
        };
        for (const [character, variations] of this.playerCharacters) {
            for (const variation of variations) {
                if (text.includes(variation)) {
                    const confidence = 0.6 + (variation.length / text.length) * 0.2;
                    if (confidence > bestMatch.confidence) {
                        bestMatch = {
                            character: this.capitalizeCharacterName(character),
                            confidence: Math.min(confidence, 0.8),
                            type: "player",
                        };
                    }
                }
            }
        }
        return bestMatch;
    }
    findNPCInText(text) {
        for (const npc of this.commonNPCs) {
            if (text.includes(npc.toLowerCase())) {
                return this.capitalizeNPCName(npc);
            }
        }
        return null;
    }
    fuzzyMatch(text, target, threshold = 0.8) {
        if (text.length === 0 || target.length === 0)
            return false;
        // Simple Levenshtein distance ratio
        const distance = this.levenshteinDistance(text, target);
        const maxLength = Math.max(text.length, target.length);
        const similarity = (maxLength - distance) / maxLength;
        return similarity >= threshold;
    }
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1)
            .fill(null)
            .map(() => Array(str1.length + 1).fill(null));
        for (let i = 0; i <= str1.length; i++)
            matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++)
            matrix[j][0] = j;
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, // deletion
                matrix[j - 1][i] + 1, // insertion
                matrix[j - 1][i - 1] + substitutionCost);
            }
        }
        return matrix[str2.length][str1.length];
    }
    cleanTranscriptionText(text, characterMatch) {
        let cleanedText = text;
        // Remove explicit character speech indicators
        for (const pattern of this.characterSpeechPatterns) {
            cleanedText = cleanedText.replace(pattern, "").trim();
        }
        // Remove character name if it appears at the beginning
        if (characterMatch.type === "player") {
            const charName = characterMatch.character.toLowerCase();
            const regex = new RegExp(`^${charName}[:\s]*`, "i");
            cleanedText = cleanedText.replace(regex, "").trim();
        }
        // Clean up common transcription artifacts
        cleanedText = cleanedText
            .replace(/\s+/g, " ") // Normalize whitespace
            .replace(/^\W+/, "") // Remove leading punctuation
            .trim();
        return cleanedText || text; // Fallback to original if cleaning removed everything
    }
    capitalizeCharacterName(name) {
        // Handle special cases
        const specialCases = {
            "ryn": "Ryn",
            "ron": "Ron",
            "ronin": "Ronin",
            "rime": "Rime",
            "ren": "Ren",
            "rain": "Rain",
            "thrall": "Thrall",
            "harold": "Harold",
            "granite": "Granite",
            "kara": "Kara",
            "xune": "Xune",
        };
        return specialCases[name.toLowerCase()] || name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    }
    capitalizeNPCName(name) {
        return name
            .split(" ")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
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
    // Group consecutive segments by the same speaker
    groupSegmentsBySpeaker(segments) {
        if (segments.length === 0)
            return [];
        const grouped = [];
        let currentGroup = segments[0];
        for (let i = 1; i < segments.length; i++) {
            const segment = segments[i];
            // If same speaker and close in time (within 5 seconds), combine
            if (segment.speaker === currentGroup.speaker &&
                segment.startTime - currentGroup.endTime <= 5) {
                currentGroup = {
                    ...currentGroup,
                    endTime: segment.endTime,
                    text: `${currentGroup.text} ${segment.text}`.trim(),
                    confidence: Math.min(currentGroup.confidence, segment.confidence),
                    originalText: `${currentGroup.originalText} ${segment.originalText}`,
                };
            }
            else {
                grouped.push(currentGroup);
                currentGroup = segment;
            }
        }
        grouped.push(currentGroup);
        return grouped;
    }
}
