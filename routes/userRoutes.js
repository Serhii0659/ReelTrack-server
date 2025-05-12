// server/routes/userRoutes.js

import express from 'express';
const router = express.Router();
import { protect } from '../middleware/authMiddleware.js';
import multer from 'multer'; // <--- ДОДАНО: Імпорт multer
import path from 'path';   // <--- ДОДАНО: Імпорт path для роботи зі шляхами файлів

// <--- ДОДАНО: Конфігурація сховища для multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Переконайтеся, що ця папка існує у корені вашого серверного проекту.
    // Наприклад, створіть її: `server/uploads/avatars`
    cb(null, 'uploads/avatars/'); // Шлях, куди будуть зберігатися завантажені аватари
  },
  filename: (req, file, cb) => {
    // Генеруємо унікальне ім'я файлу для запобігання конфліктам.
    // req.user.id стає доступним після `protect` middleware.
    cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// <--- ДОДАНО: Ініціалізація multer upload middleware
const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // Обмеження розміру файлу: 5 МБ (за бажанням, можна змінити)
  fileFilter: (req, file, cb) => {
    // Фільтр для дозволених типів файлів (рекомендовано для безпеки)
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Дозволені лише файли зображень (jpeg, jpg, png, gif)!'));
    }
  },
});


import {
    getUserProfile,
    updateUserProfile,
    getUserPublicProfile,
    sendFriendRequest,
    acceptFriendRequest,
    rejectOrRemoveFriend,
    getFriends,
    getFriendRequests,
    getFriendWatchlist,
    getUserStats,
    getUserReviews,
    addContentToLibrary,
    searchUsers,
    getUserWatchlistStatus,
    deleteReview, // <--- ДОДАНО ЦЕЙ ІМПОРТ
} from '../controllers/userController.js';

// Profile routes
router.route('/profile')
    .get(protect, getUserProfile)
    .put(protect, upload.single('avatar'), updateUserProfile); // <--- ЗМІНЕНО: Додано multer middleware
                                                             // 'avatar' - це назва поля форми (name),
                                                             // через яке ви надсилаєте файл аватара з фронтенду.
router.get('/:userId/profile', getUserPublicProfile);

// Friend routes
router.post('/friends/request/:userId', protect, sendFriendRequest);
router.post('/friends/accept/:userId', protect, acceptFriendRequest);
router.delete('/friends/remove/:userId', protect, rejectOrRemoveFriend);
router.get('/friends', protect, getFriends);
router.get('/friends/requests', protect, getFriendRequests);
router.get('/:userId/watchlist', protect, getFriendWatchlist);

// Watchlist status and add
router.get('/watchlist/status/:mediaType/:tmdbId', protect, getUserWatchlistStatus);
router.post('/library/add', protect, addContentToLibrary); // This seems to be a duplicate from contentRoutes, confirm if needed

// Stats and reviews
router.get('/stats', protect, getUserStats);
router.get('/my-reviews', protect, getUserReviews);
router.delete('/my-reviews/:reviewId', protect, deleteReview); // <--- ДОДАНО ЦЕЙ МАРШРУТ

// User search
router.get('/search', protect, searchUsers);

export default router;
