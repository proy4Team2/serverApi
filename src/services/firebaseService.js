const { admin } = require('../config/firebase');

class FirebaseService {
    constructor() {
        this.db = null;
        this.auth = null;
    }

    initialize(firestoreInstance) {
        this.db = firestoreInstance;
        this.auth = admin.auth();
    }

    async createUserAuth(email, password, displayName) {
        if (!this.auth) throw new Error('Firebase Auth not initialized');
        return await this.auth.createUser({ email, password, displayName });
    }

    async updateUserAuth(uid, updatedFields) {
        if (!this.auth) throw new Error('Firebase Auth not initialized');
        return await this.auth.updateUser(uid, updatedFields);
    }

    async saveUserProfile(uid, email, name) {
        if (!this.db) throw new Error('Firebase not initialized');
        await this.db.collection('users').doc(uid).set({
            uid, email, name: name || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    async getUserProfile(uid) {
        if (!this.db) throw new Error('Firebase not initialized');
        const doc = await this.db.collection('users').doc(uid).get();
        if (!doc.exists) throw new Error('User profile not found');
        return doc.data();
    }

    async saveCompleteAnalysis(sessionId, analysisData) {
        if (!this.db) throw new Error('Firebase not initialized');

        const batch = this.db.batch();
        const transcriptionRef = this.db.collection('transcriptions').doc(sessionId);
        
        const { aiAnalysis, metrics, transcription, ...metaData } = analysisData;

        batch.set(transcriptionRef, {
            ...metaData, 
            transcript: transcription.text,
            summaryScore: aiAnalysis?.oratory_expert?.score || 0,
            summaryVerdict: aiAnalysis?.recruiter_verdict?.passed || false,
            wpm: metrics.wpm,
            duration: metrics.duration_seconds
        });

        const aiRef = transcriptionRef.collection('analysis').doc('feedback');
        batch.set(aiRef, aiAnalysis);

        const techRef = transcriptionRef.collection('analysis').doc('technical');
        batch.set(techRef, {
            metrics: metrics,
            words: transcription.words, 
            contextUsed: analysisData.contextUsed || []
        });

        await batch.commit();
        return sessionId;
    }

    async getTranscription(sessionId, userId) {
        if (!this.db) throw new Error('Firebase not initialized');
        const doc = await this.db.collection('transcriptions').doc(sessionId).get();

        if (!doc.exists) throw new Error('Session not found');
        const data = doc.data();
        
        if (data.userId !== userId) throw new Error('Access denied');
        return data;
    }

    async getCompleteSession(sessionId, userId) {
        if (!this.db) throw new Error('Firebase not initialized');
        
        const transcriptionDoc = await this.getTranscription(sessionId, userId);

        const analysisRef = this.db.collection('transcriptions').doc(sessionId).collection('analysis');
        const [feedbackDoc, technicalDoc] = await Promise.all([
            analysisRef.doc('feedback').get(),
            analysisRef.doc('technical').get()
        ]);

        return {
            ...transcriptionDoc,
            feedback: feedbackDoc.exists ? feedbackDoc.data() : null,
            technical: technicalDoc.exists ? technicalDoc.data() : null
        };
    }

    async listSessions(userId, limit = 10) {
        if (!this.db) throw new Error('Firebase not initialized');

        const query = this.db
            .collection('transcriptions')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .select('sessionId', 'language', 'transcript', 'createdAt', 'summaryScore', 'summaryVerdict');

        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data());
    }

    async deleteSession(sessionId, userId) {
        if (!this.db) throw new Error('Firebase not initialized');
        
        await this.getTranscription(sessionId, userId); 

        const batch = this.db.batch();
        const transcriptionRef = this.db.collection('transcriptions').doc(sessionId);

        const analysisSnapshot = await transcriptionRef.collection('analysis').get();
        analysisSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        batch.delete(transcriptionRef);
        await batch.commit();

        return true;
    }
}

module.exports = new FirebaseService();