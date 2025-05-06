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

const router = express.Router(); // <-- Створюємо роутер

// Застосовуємо middleware 'protect' до ВСІХ наступних маршрутів у цьому роутері
router.use(protect); // <<< ДОДАЙ ЦЕЙ РЯДОК

// --- Профіль поточного користувача --- (Тепер захищено)
router.route('/profile')
    .get(getUserProfile)
    .put(updateUserProfile);

// --- Профіль іншого користувача (публічний/для друзів) --- (Тепер захищено, хоча логіка контролера перевіряє приватність)
router.get('/:userId/profile', getUserPublicProfile);

// --- Список перегляду іншого користувача --- (Тепер захищено, хоча логіка контролера перевіряє приватність)
router.get('/:userId/watchlist', getFriendWatchlist);

// --- Друзі --- (Тепер захищено)
router.post('/friends/request/:userId', sendFriendRequest);
router.post('/friends/accept/:userId', acceptFriendRequest);
router.delete('/friends/friends/remove/:userId', rejectOrRemoveFriend); // <-- Увага, тут у тебе може бути одрук в 'friends/friends/remove', згідно документації було '/friends/remove/{userId}'
router.get('/friends', getFriends);
router.get('/friends/requests', getFriendRequests);

// --- Статистика --- (Тепер захищено)
router.get('/stats', getUserStats);

// --- Генерація картинок ---
// router.get('/share/stats', generateShareImage); // Ці теж будуть захищені, якщо розкоментуєш
// router.get('/share/recommendation/:watchlistItemId', generateRecommendationCard);

export default router;