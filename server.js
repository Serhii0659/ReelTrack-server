// server.js
console.log('--- ВЕРСІЯ СЕРВЕРА ЗАПУЩЕНА ---');

import dotenv from 'dotenv';
dotenv.config();

console.log('JWT_SECRET from server.js (after dotenv.config()):', process.env.JWT_SECRET);

import express from 'express';
import mongoose from 'mongoose';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors'; // <--- ІМПОРТУЄМО CORS MIDDLEWARE

// Імпортуємо ваші маршрути
import authRoutes from './routes/authRoutes.js'; // Переконайтеся, що це 'authRoutes.js'
import userRoutes from './routes/userRoutes.js';
import watchlistRoutes from './routes/watchlistRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import contentRoutes from './routes/contentRoutes.js'; // <--- ДОДАНО: Імпорт маршрутів контенту

// Визначення __dirname для ES модулів
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// --- НАЛАШТУВАННЯ CORS (Виправлено allowedHeaders) ---
// Визначаємо список дозволених джерел
// Включаємо URL фронтенду для розробки (http://localhost:5173)
// та URL бекенду (http://localhost:5000), якщо він також може бути джерелом запитів
// А ТАКОЖ URL ФРОНТЕНДУ В РЕЖИМІ PROD
const allowedOrigins = [
    'http://localhost:5173', // URL вашого фронтенду під час розробки
    'http://localhost:5000', // URL вашого бекенду (якщо потрібно)
    process.env.CLIENT_URL_PROD, // URL вашого фронтенду в режимі production
    // Додайте інші URL-и, якщо потрібно
];

// Фільтруємо null/undefined значення, якщо змінна середовища не встановлена
const filteredAllowedOrigins = allowedOrigins.filter(origin => origin);

console.log(`Сервер дозволяє запити з джерел: ${filteredAllowedOrigins.join(', ')}`);

app.use(cors({
    origin: function (origin, callback) {
        // Дозволяємо запити без 'Origin' заголовка (наприклад, з Postman або curl)
        // АБО якщо 'Origin' знаходиться у списку дозволених джерел
        if (!origin || filteredAllowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error(`Not allowed by CORS - Origin: ${origin}`)); // Додаємо Origin до повідомлення про помилку
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Дозволені HTTP методи
    // --- ЯВНО ДОЗВОЛЯЄМО НЕОБХІДНІ ЗАГОЛОВКИ (включаючи Authorization) ---
    allowedHeaders: ['Content-Type', 'Authorization'],
    // --- ---
    credentials: true, // Дозволяє надсилати куки та заголовки авторизації
}));
// --- КІНЕЦЬ НАЛАШТУВАННЯ CORS ---


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
// Використовуємо більш загальний обробник помилок, який ми імпортували
// import { notFound, errorHandler } from './middleware/errorMiddleware.js';
// Якщо ви використовуєте окремі middleware для помилок, переконайтеся, що вони імпортовані
// app.use(notFound); // Якщо у вас є middleware для 404
// app.use(errorHandler); // Якщо у вас є загальний обробник помилок

// Залишаємо вашу поточну базову обробку помилок, якщо у вас немає окремих middleware
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
    // Логуємо дозволені джерела
    console.log(`Сервер дозволяє запити з джерел: ${filteredAllowedOrigins.join(', ')}`);
});