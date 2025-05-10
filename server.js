// C:\Users\kreps\Documents\Projects\ReelTrack\server\server.js
console.log('--- ВЕРСІЯ СЕРВЕРА ЗАПУЩЕНА ---');

import dotenv from 'dotenv';
dotenv.config();

console.log('JWT_SECRET from server.js (after dotenv.config()):', process.env.JWT_SECRET);

import express from 'express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

// Імпортуємо ваші маршрути
import authRoutes from './routes/authRoutes.js'; // Переконайтеся, що це 'authRoutes.js'
import userRoutes from './routes/userRoutes.js';
import watchlistRoutes from './routes/watchlistRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import contentRoutes from './routes/contentRoutes.js'; // <--- ДОДАНО: Імпорт маршрутів контенту

// Визначення __dirname для ES модулів
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Підключення до MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// НАЛАШТУВАННЯ MIDDLEWARE

// Morgan для логування запитів
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// *** ВАЖЛИВО: ЦЕЙ БЛОК ДЛЯ ДІАГНОСТИКИ CORS ***
// Не видаляйте його, поки проблема не буде вирішена.
app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    console.log('\n--- CORS Debugging ---');
    console.log('Request Method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request Origin Header (from browser):', requestOrigin);
    console.log('Configured CLIENT_URL (from .env):', process.env.CLIENT_URL);
    
    res.setHeader('Access-Control-Allow-Origin', requestOrigin || '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin, Access-Control-Request-Headers');

    console.log('Attempting to set CORS headers manually.');
    
    if (req.method === 'OPTIONS') {
        console.log('Sending 204 response for OPTIONS preflight.');
        return res.sendStatus(204);
    }

    console.log('Proceeding to next middleware.');
    next();
});
// *** КІНЕЦЬ ДІАГНОСТИЧНОГО БЛОКУ CORS ***


// Стандартні middleware для парсингу тіла запиту
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Налаштування статичної папки для завантажень
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// МАРШРУТИ API
app.get('/', (req, res) => {
    res.send('ReelTrack API is running!');
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// Додайте інші ваші маршрути тут:
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/content', contentRoutes); // <--- ДОДАНО: Підключення маршрутів контенту

// Обробка помилок (розмістіть після всіх маршрутів)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        message: err.message || 'Внутрішня помилка сервера',
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
    });
});


// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT} у режимі ${process.env.NODE_ENV}`);
    console.log(`Клієнтська частина очікується з: ${process.env.CLIENT_URL}, ${process.env.CLIENT_URL_PROD}`);
});