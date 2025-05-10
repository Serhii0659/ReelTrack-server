import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import dotenv from 'dotenv';

const router = express.Router();

// --- Реєстрація ---
router.post('/register', async (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    try {
        // Перевірка, чи користувач вже існує
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Створення нового користувача
        const user = new User({ email, password, name });
        await user.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error("Registration Error:", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// --- Логін ---
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const payload = {
            userId: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
        };

        // Генеруємо access token (1 година) та refresh token (7 днів)
        console.log('Auth Routes (Login/Register) - JWT_SECRET:', process.env.JWT_SECRET); // Можеш залишити цей лог для перевірки
        const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Зберігаємо refresh token в базі даних (для перевірки пізніше)
        user.refreshToken = refreshToken;
        await user.save();

        res.json({
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// --- Оновлення токену ---
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token is required' });
    }

    try {
        // Перевіряємо, чи refresh token валідний і не прострочений
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        // Генеруємо новий access token
        const payload = {
            userId: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
        };

        const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        const newRefreshToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Оновлюємо refresh token в базі
        user.refreshToken = newRefreshToken;
        await user.save();

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    } catch (error) {
        console.error("Refresh Error:", error);
        res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
});

// --- Перевірка токену ---
router.get('/verify-token', async (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ isValid: false, message: 'No token provided or token is malformed' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId).select('-password -refreshToken');

        if (!user) {
            return res.status(404).json({ isValid: false, message: 'User not found associated with token' });
        }

        res.status(200).json({
            isValid: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            message: 'Token is valid'
        });

    } catch (error) {
        console.error("Помилка перевірки токена:", error.message);
        return res.status(401).json({ isValid: false, message: 'Invalid or expired token' });
    }
});

// --- Оновлення профілю з перевіркою токену ---
router.put('/profile/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.userId !== req.params.id) {
            return res.status(403).json({ message: 'Forbidden: You can update only your own profile' });
        }

        const { name, email, password } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (name) user.name = name;
        if (email) user.email = email;
        if (password) user.password = password;

        await user.save();
        res.status(200).json({ message: 'Profile updated successfully', user });
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(401).json({ message: 'Invalid or expired token' });
    }
});

// --- Вихід ---
router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({ message: 'Refresh token is required' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (user) {
            user.refreshToken = null;
            await user.save();
        }

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error("Logout Error:", error);
        res.status(500).json({ message: 'Server error during logout' });
    }
});

export default router;