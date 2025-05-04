import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const protect = async (req, res, next) => {
    let token;

    // Читаємо JWT з 'Bearer' токена в заголовку Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // Верифікуємо токен
            const decoded = jwt.verify(token, JWT_SECRET);

            // Знаходимо користувача за ID з токена (без пароля та refreshToken)
            // Використання .select('-password -refreshToken') не є строго необхідним
            // через метод toJSON в моделі, але це додаткова гарантія.
            req.user = await User.findById(decoded.userId).select('-password -refreshToken');

            if (!req.user) {
                // Якщо користувача видалили після видачі токену
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            next(); // Переходимо до наступного middleware/маршруту
        } catch (error) {
            console.error('Token verification failed:', error);
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token expired' });
            }
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// (Опціонально) Middleware для перевірки ролі Адміністратора
const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized as an admin' });
    }
};

export { protect, admin };