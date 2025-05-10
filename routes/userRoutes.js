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
    getUserPublicProfile,
    getFriendWatchlist,
    // generateShareImage,
    // generateRecommendationCard,
    addContentToLibrary, // <<< ДОДАНО: Імпорт функції контролера
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js'; // Імпорт middleware

// === ІМПОРТУЄМО MULTER ТА НАЛАШТОВУЄМО ЗБЕРІГАННЯ ===
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: function (req, file, cb) {
        const userId = req.user._id;
        const fileExtension = path.extname(file.originalname);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `avatar_${userId}_${uniqueSuffix}${fileExtension}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 },
    fileFilter: function(req, file, cb){
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if(mimetype && extname){
            return cb(null, true);
        } else {
            cb('Error: Images Only!');
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
    .put(upload.single('avatar'), updateUserProfile);

// Профіль іншого користувача (публічний/для друзів)
router.get('/:userId/profile', getUserPublicProfile);

// Список перегляду іншого користувача
router.get('/:userId/watchlist', getFriendWatchlist);

// Друзі
router.post('/friends/request/:userId', sendFriendRequest);
router.post('/friends/accept/:userId', acceptFriendRequest);
router.delete('/friends/remove/:userId', rejectOrRemoveFriend);

// Отримати список друзів та запитів
router.get('/friends', getFriends);
router.get('/friends/requests', getFriendRequests);

// Статистика
router.get('/stats', getUserStats);

// === ДОДАНО: Маршрут для додавання контенту до бібліотеки ===
router.post('/library/add', addContentToLibrary); // <<< ЦЕЙ РЯДОК БУВ ВІДСУТНІЙ

// Генерація картинок (закоментовано)
// router.get('/share/stats', generateShareImage);
// router.get('/share/recommendation/:watchlistItemId', generateRecommendationCard);


// === Експортуємо роутер (ОДИН раз) ===
export default router;