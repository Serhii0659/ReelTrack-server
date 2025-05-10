// C:\Users\kreps\Documents\Projects\ReelTrack\server\middleware\authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js'; // Переконайтеся, що шлях та регістр 'User.js' правильні
import asyncHandler from 'express-async-handler'; // <--- ДОДАНО: Імпорт asyncHandler

// УВАГА: import dotenv та dotenv.config() ВИДАЛЕНО ЗВІДСИ!
// ВОНИ ПОВИННІ БУТИ ЛИШЕ У server.js.
// УВАГА: top-level константа JWT_SECRET ВИДАЛЕНА, використовуємо process.env.JWT_SECRET напряму.

// Обгортаємо функцію protect у asyncHandler для автоматичної обробки асинхронних помилок
const protect = asyncHandler(async (req, res, next) => {
    // console.log('Auth Middleware - JWT_SECRET (від process.env):', process.env.JWT_SECRET ? 'Loaded' : 'Not Loaded'); // Можеш залишити цей лог, щоб переконатися, що секрет тепер завантажується
    let token;

    // Перевіряємо, чи є заголовок авторизації і чи він починається з 'Bearer'
    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
        // Якщо токен відсутній або заголовок сформований неправильно, повертаємо 401
        res.status(401); // Встановлюємо статус
        throw new Error('Not authorized, no token or malformed header'); // Кидаємо помилку для asyncHandler
    }

    try {
        // Витягуємо токен
        token = req.headers.authorization.split(' ')[1];
        // console.log('Extracted Token in Auth Middleware (first 10 chars):', token ? token.substring(0, 10) + '...' : 'None'); // Обрізаємо для логування
        // console.log('Type of Extracted Token:', typeof token); 

        // Перевіряємо токен
        // ЗМІНЕНО: Використовуємо process.env.JWT_SECRET для jwt.verify
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // <--- ЗМІНЕНО: ВИКОРИСТОВУЄМО process.env.JWT_SECRET

        // Знаходимо користувача за ID з токена
        // Примітка: якщо в твоєму JWT payload user ID зберігається під ключем 'id', то 'decoded.id' правильний.
        // Якщо 'userId' (як було раніше), то поверни 'decoded.userId'. Перевір, що генерує authRoutes.js
        req.user = await User.findById(decoded.userId).select('-password -refreshToken'); // <--- ЗМІНЕНО: decoded.id (якщо це вірно для твого JWT payload)

        // Якщо користувача не знайдено (наприклад, видалили після видачі токену)
        if (!req.user) {
            res.status(401);
            throw new Error('Not authorized, user not found');
        }

        // Переходимо до наступного middleware/маршруту
        next();

    } catch (error) {
        // Записуємо помилку для налагодження
        console.error('Token verification failed:', error);
        console.error('Error details in authMiddleware:', error.message, error.name);

        // Обробляємо конкретні помилки JWT
        if (error.name === 'TokenExpiredError') {
            res.status(401);
            throw new Error('Not authorized, token expired');
        }
        // Для будь-яких інших помилок верифікації токена (наприклад, JsonWebTokenError за невірний підпис)
        res.status(401);
        throw new Error('Not authorized, token failed');
    }
});

// (Опціонально) Middleware для перевірки ролі Адміністратора
const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403); // <--- Встановлюємо статус
        throw new Error('Not authorized as an admin'); // <--- Кидаємо помилку для asyncHandler
    }
};

export { protect, admin };