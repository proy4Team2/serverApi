// src/services/firebaseService.js
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

    // --- AUTENTICACIÓN Y USUARIOS ---

    async createUserAuth(email, password, displayName) {
        if (!this.auth) throw new Error('Firebase Auth no inicializado');
        return await this.auth.createUser({ email, password, displayName });
    }

    async updateUserAuth(uid, updatedFields) {
        if (!this.auth) throw new Error('Firebase Auth no inicializado');
        return await this.auth.updateUser(uid, updatedFields);
    }

    async loginUser(email, password) {
        const apiKey = process.env.FIREBASE_WEB_API_KEY;
        if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY no está configurada en .env');

        const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: password,
                returnSecureToken: true
            })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error.message || 'Error al iniciar sesión');

        return {
            uid: data.localId,
            idToken: data.idToken,
            email: data.email
        };
    }

    async saveUserProfile(uid, email, name) {
        if (!this.db) throw new Error('Firebase no inicializado');
        
        await this.db.collection('users').doc(uid).set({
            uid, email, name: name || '',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            dashboardStats: {
                totalSessions: 0,
                averageScore: 0,
                sessionsPassed: 0,
                averageWpm: 0,
                lastSessionDate: null
            }
        }, { merge: true });
    }

    async getUserProfile(uid) {
        if (!this.db) throw new Error('Firebase no inicializado');
        const doc = await this.db.collection('users').doc(uid).get();
        if (!doc.exists) throw new Error('Perfil de usuario no encontrado');
        return doc.data();
    }

    // --- SESIONES Y PROGRESO ---

    async saveCompleteAnalysis(sessionId, completeData) {
        if (!this.db) throw new Error('Firebase no inicializado');

        const { userId, aiAnalysis, metrics, createdAt, language } = completeData;
        const score = aiAnalysis?.oratory_expert?.score || 0;
        const passed = aiAnalysis?.recruiter_verdict?.passed || false;

        const sessionDocument = {
            sessionId,
            userId,
            createdAt,
            language,
            metrics: {
                ...metrics,
                score: score,
                passed: passed
            },
            feedback: {
                summary: aiAnalysis?.oratory_expert?.summary || "",
                strengths: aiAnalysis?.oratory_expert?.strengths || [],
                weaknesses: aiAnalysis?.oratory_expert?.weaknesses || [],
                improvement_plan: aiAnalysis?.improvement_plan || {},
                decision_rationale: aiAnalysis?.recruiter_verdict?.decision_rationale || ""
            }
        };

        const batch = this.db.batch();
        
        // 1. Guardar la sesión plana
        const sessionRef = this.db.collection('sessions').doc(sessionId);
        batch.set(sessionRef, sessionDocument);

        // 2. Actualizar las estadísticas del Dashboard del usuario
        const userRef = this.db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const stats = userData.dashboardStats || { totalSessions: 0, averageScore: 0, sessionsPassed: 0, averageWpm: 0 };
            
            const newTotal = stats.totalSessions + 1;
            const newAvgScore = ((stats.averageScore * stats.totalSessions) + score) / newTotal;
            const newAvgWpm = ((stats.averageWpm * stats.totalSessions) + (metrics.wpm || 0)) / newTotal;
            const newPassed = passed ? stats.sessionsPassed + 1 : stats.sessionsPassed;

            batch.update(userRef, {
                'dashboardStats.totalSessions': newTotal,
                'dashboardStats.averageScore': Number(newAvgScore.toFixed(2)),
                'dashboardStats.averageWpm': Number(newAvgWpm.toFixed(2)),
                'dashboardStats.sessionsPassed': newPassed,
                'dashboardStats.lastSessionDate': createdAt
            });
        }

        await batch.commit();
        return sessionId;
    }

    async listSessions(userId, limit = 10) {
        if (!this.db) throw new Error('Firebase no inicializado');
        const query = this.db
            .collection('sessions')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit);
        const snapshot = await query.get();
        return snapshot.docs.map(doc => doc.data());
    }

    async getCompleteSession(sessionId, userId) {
        if (!this.db) throw new Error('Firebase no inicializado');
        const doc = await this.db.collection('sessions').doc(sessionId).get();
        if (!doc.exists) throw new Error('Session not found');
        const data = doc.data();
        if (data.userId !== userId) throw new Error('Access denied');
        return data;
    }

    async deleteSession(sessionId, userId) {
        if (!this.db) throw new Error('Firebase no inicializado');
        await this.getCompleteSession(sessionId, userId); 
        await this.db.collection('sessions').doc(sessionId).delete();
        return true;
    }
}

module.exports = new FirebaseService();