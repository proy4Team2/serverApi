// src/services/analysisService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

class AnalysisService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: { responseMimeType: "application/json" }
        });
    }

    async analyzeInterview(history, metrics, language = 'es') {
        try {
            const prompt = this._buildPrompt(history, metrics, language);

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            return JSON.parse(text);
        } catch (error) {
            console.error("Gemini Analysis Error:", error);
            return {
                error: "Analysis generation failed.",
                details: error.message,
                fallback_metrics: metrics
            };
        }
    }

    _buildPrompt(history, metrics, language) {
        const conversationText = JSON.stringify(history, null, 2);
        
        const feedbackLang = language === 'es' ? 'SPANISH' : 'ENGLISH';
        const targetRoleLang = language === 'es' ? 'Spanish-speaking' : 'English-speaking';

        return `
        You are an advanced dual-expert AI system evaluating a software engineering job interview.
        
        INPUT DATA:
        - Language Context: ${feedbackLang}
        - Student Audio Metrics: ${JSON.stringify(metrics)}
        - Transcript (Dialog format):
        ${conversationText}

        INSTRUCTIONS:
        Analyze the candidate performance assuming TWO DISTINCT EXPERT ROLES.
        
        *** CRITICAL CONTEXT ***
        The Transcript contains dialogue separated by roles: "recruiter" (asking questions) and "student" (answering).
        ONLY evaluate the performance, communication, structure, and answers of the "student". Do not evaluate the recruiter.
        Use the provided Student Audio Metrics to evaluate pacing (WPM), which has been pre-calculated based ONLY on the student's speaking time.

        *** CRITICAL INSTRUCTION ***
        The CONTENT of your JSON response MUST BE IN ${feedbackLang}.
        ****************************

        ---
        ROLE 1: PUBLIC SPEAKING COACH
        Objective: Evaluate delivery, structure, and clarity of the student.
        
        KNOWLEDGE BASE:
        1. **Toulmin Model**: Does the student connect Data -> Warrant -> Claim?
        2. **Cohesion**: Penalize circumlocution. Reward conciseness.
        3. **Confidence**: Detect hedging vs. assertive language.
        4. **Pacing**: Analyze WPM (${metrics.wpm}). Is it too fast (>160) or too slow (<110)?

        ---
        ROLE 2: SENIOR FAANG RECRUITER (${targetRoleLang} context)
        Objective: Evaluate technical competence and behavioral fit of the student.
        
        KNOWLEDGE BASE:
        1. **STAR Method**: Checks for Situation, Task, Action, Result in behavioral answers.
        2. **Ownership**: Looks for "I implemented" vs "We/It happened".
        3. **Red Flags**: Inconsistencies, lack of depth, or defensiveness.

        ---
        OUTPUT JSON FORMAT:
        {
            "oratory_expert": {
                "score": number (0-100),
                "summary": "Executive summary of communication style (${feedbackLang}).",
                "strengths": ["point 1", "point 2"],
                "weaknesses": ["point 1", "point 2"],
                "pacing_feedback": "Specific feedback on pace based on the provided WPM metric (${feedbackLang})."
            },
            "recruiter_verdict": {
                "passed": boolean,
                "decision_rationale": "Professional justification for hiring decision (${feedbackLang}).",
                "star_method_check": "Did they use STAR? Analysis (${feedbackLang}).",
                "soft_skills": ["skill 1", "skill 2"],
                "red_flags": ["flag 1"]
            },
            "improvement_plan": {
                "immediate_action": "Top 1 tip to apply immediately (${feedbackLang}).",
                "long_term_advice": "Career development advice (${feedbackLang})."
            }
        }
        `;
    }
}

module.exports = new AnalysisService();