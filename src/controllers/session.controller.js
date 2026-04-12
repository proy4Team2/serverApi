// src/controllers/session.controller.js
const { v4: uuidv4 } = require('uuid');
const deepgramService = require('../services/deepgramService');
const analysisService = require('../services/analysisService');
const firebaseService = require('../services/firebaseService');

exports.createSession = async (req, res, next) => {
    const sessionId = uuidv4();
    const userId = req.user.uid;

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha proporcionado ningún archivo de audio' });
        }

        let conversationHistory = [];
        try {
            if (req.body.conversationHistory) {
                conversationHistory = JSON.parse(req.body.conversationHistory);
            }
        } catch (e) {
            console.warn("No se pudo parsear el historial previo, iniciando limpio.");
            conversationHistory = [];
        }

        const language = req.body.language || 'es';
        const audioBuffer = req.file.buffer;

        const transcriptionData = await deepgramService.transcribeAudio(audioBuffer, language);
        
        const chatTurns = deepgramService.extractConversationHistory(transcriptionData.allWords);
        const playerMetrics = deepgramService.calculateStudentMetrics(transcriptionData.allWords);

        conversationHistory = conversationHistory.concat(chatTurns);

        const technicalMetrics = {
            duration_seconds: transcriptionData.metadata.totalDuration,
            student_speaking_duration: playerMetrics.speaking_duration_seconds,
            word_count: playerMetrics.word_count,
            wpm: playerMetrics.wpm, 
            average_confidence: Number(transcriptionData.studentConfidence.toFixed(2))
        };

        const aiAnalysis = await analysisService.analyzeInterview(
            conversationHistory, 
            technicalMetrics, 
            language
        );

        const formattedTranscript = chatTurns.map(t => `${t.role.toUpperCase()}: ${t.text}`).join('\n\n');

        const completeData = {
            sessionId,
            userId,
            language,
            createdAt: new Date().toISOString(),
            metrics: technicalMetrics,
            aiAnalysis: aiAnalysis
        };

        await firebaseService.saveCompleteAnalysis(sessionId, completeData);

        res.status(201).json({
            success: true,
            sessionId,
            message: "Análisis completado y progreso actualizado",
            data: {
                transcript: formattedTranscript,
                student_wpm: technicalMetrics.wpm,
                score: aiAnalysis?.oratory_expert?.score || 0,
                passed: aiAnalysis?.recruiter_verdict?.passed || false,
                feedback: aiAnalysis
            }
        });

    } catch (error) {
        console.error("[Session Controller Error]:", error);
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
        res.json({ success: true, message: 'Sesión eliminada correctamente' });
    } catch (error) { next(error); }
};