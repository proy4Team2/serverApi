// src/config/deepgram.js
require('dotenv').config();

const deepgramConfig = {
    apiKey: process.env.DEEPGRAM_API_KEY,
    
    defaultParamsES: {
        model: process.env.DEEPGRAM_MODEL || 'base',
        language: 'es',
        punctuate: true,
        filler_words: true,
        smart_format: false,
        numerals: false,
        multichannel: true // <-- CLAVE: Activa la separación por canales
    },

    defaultParamsEN: {
        model: process.env.DEEPGRAM_MODEL || 'base',
        language: 'en',
        punctuate: true,
        filler_words: true,
        smart_format: false,
        numerals: false,
        multichannel: true // <-- CLAVE: Activa la separación por canales
    }
};

const validateConfig = () => {
    if (!deepgramConfig.apiKey) {
        throw new Error('DEEPGRAM_API_KEY no encontrada en las variables de entorno');
    }
    console.log('Deepgram config validada (Modo Estéreo activado)');
};

module.exports = {
    deepgramConfig,
    validateConfig
};