import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import authRoutes from './routes/auth.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: [process.env.CLIENT_URL, process.env.CLIENT_URL_PROD].filter(Boolean),
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Test route
app.get('/', (req, res) => {
    res.send('ReelTrack API is running!');
});

// Auth routes
app.use('/api/auth', authRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});