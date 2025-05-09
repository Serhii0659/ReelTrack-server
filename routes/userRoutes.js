// server\routes\userRoutes.js
import express from 'express';
import {
    updateUserProfile,
    getUserProfile,
    getUserStats,
    sendFriendRequest,
    acceptFriendRequest,
    rejectOrRemoveFriend,
    getFriends,
    getFriendRequests,
    getUserPublicProfile, // Для перегляду профілю друга
    getFriendWatchlist, // Для перегляду списку друга
    // generateShareImage,
    // generateRecommendationCard,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js'; // Імпорт middleware

// === ІМПОРТУЄМО MULTER ТА НАЛАШТОВУЄМО ЗБЕРІГАННЯ ===
import multer from 'multer'; // <-- Імпортуємо multer
import path from 'path'; // <-- Імпортуємо path для роботи зі шляхами
import { fileURLToPath } from 'url'; // <-- Імпортуємо для __dirname
import { dirname } from 'path'; // <-- Імпортуємо для __dirname

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); // <-- Коректне визначення __dirname для ES модулів

// Налаштовуємо Multer для збереження файлів
// Використовуємо diskStorage для збереження на диск
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Вказуємо папку, куди зберігати файли.
    // path.join(__dirname, '..', 'uploads') вказує на папку 'uploads' на рівень вище від папки routes (тобто у корені server)
    cb(null, path.join(__dirname, '..', 'uploads')); // <-- Папка для збереження файлів
  },
  filename: function (req, file, cb) {
    // Генеруємо унікальне ім'я файлу: user_ID_timestamp_random.ext
    const userId = req.user._id; // ID поточного користувача (доступний через protect middleware)
    const fileExtension = path.extname(file.originalname); // Розширення оригінального файлу
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); // Унікальний суфікс
    cb(null, `avatar_${userId}_${uniqueSuffix}${fileExtension}`); // <-- Формат імені файлу
  }
});

// Налаштовуємо middleware multer
// single('avatar') означає, що ми очікуємо ОДИН файл у полі форми з іменем 'avatar'
const upload = multer({
    storage: storage,
    // TODO: Додати обмеження на розмір файлу, типи файлів тощо
    limits: { fileSize: 1024 * 1024 * 5 }, // Наприклад, ліміт 5MB (5 мегабайт)
    fileFilter: function(req, file, cb){
        // Перевірка типу файлу (дозволяємо лише зображення)
        const filetypes = /jpeg|jpg|png|gif/; // Дозволені розширення (регулярний вираз)
        const mimetype = filetypes.test(file.mimetype); // Перевірка MIME типу файлу
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase()); // Перевірка розширення файлу

        if(mimetype && extname){ // Якщо і MIME тип, і розширення відповідають дозволеним
            return cb(null, true); // Дозволяємо завантаження
        } else {
            cb('Error: Images Only!'); // Відхиляємо файл з повідомленням
        }
    }
});


// === ОДНЕ ВИЗНАЧЕННЯ РОУТЕРА ===
const router = express.Router();

// Застосовуємо middleware 'protect' до ВСІХ наступних маршрутів
router.use(protect);

// --- Маршрути (визначені ОДИН раз) ---

// Профіль поточного користувача (GET захищено, PUT захищено та обробляється multer)
router.route('/profile')
    .get(getUserProfile)
    // === ЗАСТОСОВУЄМО MULTER ДО PUT МАРШРУТУ ===
    .put(upload.single('avatar'), updateUserProfile); // <-- ТУТ ПОВИННО БУТИ upload.single('avatar')


// Профіль іншого користувача (публічний/для друзів)
router.get('/:userId/profile', getUserPublicProfile);

// Список перегляду іншого користувача
router.get('/:userId/watchlist', getFriendWatchlist);

// Друзі
router.post('/friends/request/:userId', sendFriendRequest);
router.post('/friends/accept/:userId', acceptFriendRequest);
// Перевірка на одруківку, маршрут має бути '/friends/remove/:userId'
router.delete('/friends/remove/:userId', rejectOrRemoveFriend);

// Отримати список друзів та запитів
router.get('/friends', getFriends);
router.get('/friends/requests', getFriendRequests);

// Статистика
router.get('/stats', getUserStats);

// Генерація картинок (закоментовано)
// router.get('/share/stats', generateShareImage);
// router.get('/share/recommendation/:watchlistItemId', generateRecommendationCard);


// === Експортуємо роутер (ОДИН раз) ===
export default router;