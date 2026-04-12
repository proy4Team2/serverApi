// src/services/deepgramService.js
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
                audioBuffer,
                {
                    model: params.model,
                    language: params.language,
                    punctuate: params.punctuate,
                    filler_words: params.filler_words,
                    smart_format: params.smart_format,
                    numerals: params.numerals,
                    multichannel: params.multichannel
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
        if (!data?.results?.channels || data.results.channels.length < 2) {
            throw new Error('El audio procesado no contiene los 2 canales esperados (Estéreo).');
        }

        // Canal 0 = Alumno (Player), Canal 1 = Reclutador (NPC)
        const studentChannel = data.results.channels[0].alternatives[0];
        const recruiterChannel = data.results.channels[1].alternatives[0];
        
        let allWords = [];
        
        if (studentChannel.words) {
            const studentWords = studentChannel.words.map(w => ({
                word: w.word,
                punctuatedWord: w.punctuated_word || w.word,
                start: w.start,
                end: w.end,
                confidence: w.confidence,
                role: 'student'
            }));
            allWords = allWords.concat(studentWords);
        }

        if (recruiterChannel.words) {
            const recruiterWords = recruiterChannel.words.map(w => ({
                word: w.word,
                punctuatedWord: w.punctuated_word || w.word,
                start: w.start,
                end: w.end,
                confidence: w.confidence,
                role: 'recruiter'
            }));
            allWords = allWords.concat(recruiterWords);
        }

        allWords.sort((a, b) => a.start - b.start);

        return {
            studentTranscript: studentChannel.transcript,
            recruiterTranscript: recruiterChannel.transcript,
            allWords: allWords,
            studentConfidence: studentChannel.confidence || 0,
            metadata: {
                totalDuration: data.metadata?.duration || 0,
            }
        };
    }

    extractConversationHistory(allWords) {
        const utterances = [];
        let currentRole = null;
        let currentSentence = [];

        allWords.forEach(word => {
            if (word.role !== currentRole) {
                if (currentSentence.length > 0) {
                    utterances.push({ role: currentRole, text: currentSentence.join(' ') });
                }
                currentRole = word.role;
                currentSentence = [word.punctuatedWord];
            } else {
                currentSentence.push(word.punctuatedWord);
            }
        });

        if (currentSentence.length > 0) {
            utterances.push({ role: currentRole, text: currentSentence.join(' ') });
        }

        return utterances;
    }

    calculateStudentMetrics(allWords) {
        const studentWords = allWords.filter(w => w.role === 'student');
        
        if (studentWords.length === 0) {
            return { word_count: 0, speaking_duration_seconds: 0, wpm: 0 };
        }

        const firstWordStart = studentWords[0].start;
        const lastWordEnd = studentWords[studentWords.length - 1].end;
        const speakingDuration = lastWordEnd - firstWordStart;

        const safeDuration = speakingDuration > 0 ? speakingDuration : 0.1;

        return {
            word_count: studentWords.length,
            speaking_duration_seconds: parseFloat(safeDuration.toFixed(2)),
            wpm: parseFloat((studentWords.length / (safeDuration / 60)).toFixed(1))
        };
    }
}

module.exports = new DeepgramService();