// src/middleware/upload.middleware.js
const multer = require('multer');
const storage = multer.memoryStorage();

const allowedMimes = [
    'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm',
    'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/m4a',
    'audio/aac', 'audio/x-m4a'
];

const fileFilter = (req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo inválido. Soportados: WAV, MP3, FLAC, OGG, WEBM, M4A, AAC'));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 150 * 1024 * 1024 // 150 MB
    },
    fileFilter: fileFilter
});

module.exports = upload;