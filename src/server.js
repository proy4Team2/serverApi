require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initializeFirebase } = require('./config/firebase');
const { validateConfig } = require('./config/deepgram');
const firebaseService = require('./services/firebaseService');

const errorMiddleware = require('./middleware/error.middleware');
const authRoutes = require('./routes/auth.routes');
const sessionRoutes = require('./routes/session.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

try {
    validateConfig();
    const db = initializeFirebase();
    firebaseService.initialize(db);
} catch (error) {
    console.error('Error fatal de inicialización:', error.message);
    process.exit(1);
}

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

app.use(errorMiddleware);

const startServer = async () => {
    app.listen(PORT, () => {
        console.log(`Server running --- port ${PORT}`);
    });
};

startServer();

module.exports = app;