// server.js (або app.js)
import dotenv from 'dotenv';
dotenv.config(); // Завантажуємо змінні середовища на початку


import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

// === ІМПОРТИ ДЛЯ НАЛАШТУВАННЯ СТАТИЧНОЇ ПАПКИ ===
import path from 'path';
import { fileURLToPath } from 'url';

// === ВИЗНАЧЕННЯ __dirname ДЛЯ ES МОДУЛІВ ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// === ІМПОРТИ МАРШРУТІВ ===
import authRoutes from './routes/auth.js';
import userRoutes from './routes/userRoutes.js';
import contentRoutes from './routes/contentRoutes.js'; // <-- Імпортуємо нові маршрути контенту


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: [process.env.CLIENT_URL, process.env.CLIENT_URL_PROD].filter(Boolean),
    credentials: true
}));

// Стандартні middleware для парсингу тіла запиту
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === НАЛАШТУВАННЯ СТАТИЧНОЇ ПАПКИ ДЛЯ ЗАВАНТАЖЕНЬ ===
// Робимо папку 'uploads' доступною за URL '/uploads'
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Test route
app.get('/', (req, res) => {
    res.send('ReelTrack API is running!');
});

// === ПІДКЛЮЧЕННЯ МАРШРУТІВ ===
// Auth routes
app.use('/api/auth', authRoutes);
// User routes (профіль, статистика, друзі)
app.use('/api/users', userRoutes);
// Content routes (пошук, деталі контенту тощо)
app.use('/api/content', contentRoutes); // <-- ДОДАНО ЦЕЙ РЯДОК


// TODO: Обробка помилок (наприклад, 404) - можна додати тут після всіх маршрутів

// Start server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});