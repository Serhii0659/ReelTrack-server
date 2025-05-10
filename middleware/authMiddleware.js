import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const protect = async (req, res, next) => {
    console.log('Auth Middleware - JWT_SECRET:', JWT_SECRET);
    let token;

    // Перевіряємо, чи є заголовок авторизації і чи він починається з 'Bearer'
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
        // Якщо токен відсутній або заголовок сформований неправильно, повертаємо 401
        return res.status(401).json({ message: 'Not authorized, no token or malformed header' });
    }

    try {
        // Витягуємо токен
        token = req.headers.authorization.split(' ')[1];
        console.log('Extracted Token in Auth Middleware:', token); // <--- ДОДАНО
        console.log('Type of Extracted Token:', typeof token);    // <--- ДОДАНО

        // Перевіряємо токен
        const decoded = jwt.verify(token, JWT_SECRET);

        // Знаходимо користувача за ID з токена
        req.user = await User.findById(decoded.userId).select('-password -refreshToken');

        // Якщо користувача не знайдено (наприклад, видалили після видачі токену)
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }

        // Переходимо до наступного middleware/маршруту
        next();

    } catch (error) {
        // Записуємо помилку для налагодження
        console.error('Token verification failed:', error);
        console.error('Error details in authMiddleware:', error.message, error.name);

        // Обробляємо конкретні помилки JWT
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Not authorized, token expired' });
        }
        // Для будь-яких інших помилок верифікації токена (наприклад, JsonWebTokenError за невірний підпис)
        return res.status(401).json({ message: 'Not authorized, token failed' });
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