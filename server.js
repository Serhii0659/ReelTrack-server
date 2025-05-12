import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import morgan from 'morgan';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

import authRoutes from './routes/authRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import friendRoutes from './routes/friendRoutes.js';
import userRoutes from './routes/userRoutes.js';
import watchlistRoutes from './routes/watchlistRoutes.js';
import connectDB from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Check for required environment variables
if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in .env');
    process.exit(1);
}

if (!process.env.TMDB_API_KEY) {
    console.error('FATAL ERROR: TMDB_API_KEY is not defined in .env');
    process.exit(1);
}

if (!process.env.MONGODB_URI) {
    console.error('FATAL ERROR: MONGODB_URI is not defined in .env');
    process.exit(1);
}

// MongoDB connection
connectDB();

// Middleware
if (process.env.NODE_ENV === 'development') { // Development mode
    app.use(morgan('dev'));
}

const allowedOrigins = [
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
    ...(process.env.CLIENT_URL_PROD ? process.env.CLIENT_URL_PROD.split(',') : []),
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`Not allowed by CORS - Origin: ${origin}`));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.get('/', (req, res) => res.send('ReelTrack API is running!'));
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/users', userRoutes);
app.use('/api/watchlist', watchlistRoutes);

// Error handler
app.use((req, res, next) => {
    res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        message: err.message || 'Внутрішня помилка сервера',
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Сервер запущено на порту ${PORT} у режимі ${process.env.NODE_ENV}`);
    console.log(`Сервер дозволяє запити з джерел: ${allowedOrigins.join(', ')}`);
});