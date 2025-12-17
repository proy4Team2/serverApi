const { v4: uuidv4 } = require('uuid');
const deepgramService = require('../services/deepgramService');
const analysisService = require('../services/analysisService');
const firebaseService = require('../services/firebaseService');

exports.createSession = async (req, res, next) => {
    const sessionId = uuidv4();
    const userId = req.user.uid;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        let conversationHistory = [];
        try {
            if (req.body.conversationHistory) {
                conversationHistory = JSON.parse(req.body.conversationHistory);
            }
        } catch (e) {
            console.warn(e);
            conversationHistory = [];
        }

        const language = req.body.language || 'en';
        const audioBuffer = req.file.buffer;

        const transcriptionData = await deepgramService.transcribeAudio(audioBuffer, language);
        
        const words = deepgramService.extractWords(transcriptionData);
        const pauses = deepgramService.calculatePauses(words);
        const pauseStatistics = deepgramService.getPauseStatistics(pauses);
        
        const technicalMetrics = {
            duration_seconds: transcriptionData.metadata.duration,
            word_count: words.length,
            wpm: (transcriptionData.metadata.duration > 0) 
                ? (words.length / (transcriptionData.metadata.duration / 60)).toFixed(1) 
                : 0,
            pause_percentage: (transcriptionData.metadata.duration > 0)
                ? ((pauseStatistics.totalPauseTime / transcriptionData.metadata.duration) * 100).toFixed(1)
                : 0,
            average_confidence: transcriptionData.confidence.toFixed(2)
        };

        conversationHistory.push({ 
            role: 'student', 
            text: transcriptionData.transcript 
        });

        const aiAnalysis = await analysisService.analyzeInterview(
            conversationHistory, 
            technicalMetrics, 
            language
        );

        const completeAnalysis = {
            sessionId,
            userId,
            language,
            createdAt: new Date().toISOString(),
            transcription: {
                text: transcriptionData.transcript,
                words: words 
            },
            metrics: technicalMetrics,
            aiAnalysis: aiAnalysis
        };

        await firebaseService.saveCompleteAnalysis(sessionId, completeAnalysis);

        res.status(201).json({
            success: true,
            sessionId,
            data: {
                transcript: transcriptionData.transcript,
                feedback: aiAnalysis 
            }
        });

    } catch (error) {
        next(error);
    }
};

exports.listUserSessions = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const limit = parseInt(req.query.limit) || 10;
        const sessions = await firebaseService.listSessions(userId, limit);
        res.json({ success: true, data: sessions });
    } catch (error) { next(error); }
};

exports.getSessionDetails = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const { sessionId } = req.params;
        const sessionData = await firebaseService.getCompleteSession(sessionId, userId);
        res.json({ success: true, data: sessionData });
    } catch (error) { next(error); }
};

exports.deleteUserSession = async (req, res, next) => {
    try {
        const userId = req.user.uid;
        const { sessionId } = req.params;
        await firebaseService.deleteSession(sessionId, userId);
        res.json({ success: true, message: 'Session deleted successfully' });
    } catch (error) { next(error); }
};

exports.getSessionAudio = async (req, res, next) => {
    res.status(501).json({ 
        success: false, 
        error: 'Audio storage functionality is currently disabled.' 
    });
};