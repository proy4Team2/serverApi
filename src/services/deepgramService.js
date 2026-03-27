const { createClient } = require('@deepgram/sdk');
const { deepgramConfig } = require('../config/deepgram');

class DeepgramService {
    constructor() {
        this.client = createClient(deepgramConfig.apiKey);
    }

    async transcribeAudio(audioBuffer, language = 'en') {
        const params = language === 'es' 
            ? deepgramConfig.defaultParamsES 
            : deepgramConfig.defaultParamsEN;

        try {
            const { result, error } = await this.client.listen.prerecorded.transcribeFile(
                audioBuffer, // Usamos el buffer directamente
                {
                    model: params.model,
                    language: params.language,
                    punctuate: params.punctuate,
                    filler_words: params.filler_words,
                    smart_format: params.smart_format,
                    numerals: params.numerals,
                    diarize: params.diarize
                }
            );

            if (error) {
                throw new Error(`Deepgram error: ${error.message}`);
            }

            return this.parseTranscriptionResponse(result);
        } catch (error) {
            throw new Error(`Deepgram transcription failed: ${error.message}`);
        }
    }

    parseTranscriptionResponse(data) {
        if (!data?.results?.channels?.[0]?.alternatives?.[0]) {
            throw new Error('Invalid transcription response format');
        }

        const alternative = data.results.channels[0].alternatives[0];
        
        return {
            transcript: alternative.transcript,
            words: alternative.words || [],
            confidence: alternative.confidence,
            metadata: {
                duration: data.metadata?.duration || 0,
                channels: data.metadata?.channels || 1
            }
        };
    }

    extractWords(transcriptionData) {
        return transcriptionData.words.map(word => ({
            word: word.word,
            start: word.start,
            end: word.end,
            confidence: word.confidence,
            punctuatedWord: word.punctuated_word
        }));
    }

    calculatePauses(words) {
        const pauses = [];
        
        for (let i = 0; i < words.length - 1; i++) {
            const currentEnd = words[i].end;
            const nextStart = words[i + 1].start;
            const pauseDuration = nextStart - currentEnd;

            if (pauseDuration > 0) {
                pauses.push({
                    afterWord: words[i].word,
                    beforeWord: words[i + 1].word,
                    duration: pauseDuration,
                    startTime: currentEnd,
                    endTime: nextStart
                });
            }
        }

        return pauses;
    }

    getPauseStatistics(pauses) {
        if (pauses.length === 0) {
            return {
                totalPauses: 0,
                totalPauseTime: 0,
                averagePauseDuration: 0,
                longestPause: null,
                shortestPause: null
            };
        }

        const pauseDurations = pauses.map(p => p.duration);
        const totalPauseTime = pauseDurations.reduce((sum, duration) => sum + duration, 0);
        
        return {
            totalPauses: pauses.length,
            totalPauseTime: totalPauseTime,
            averagePauseDuration: totalPauseTime / pauses.length,
            longestPause: Math.max(...pauseDurations),
            shortestPause: Math.min(...pauseDurations)
        };
    }
}

module.exports = new DeepgramService();