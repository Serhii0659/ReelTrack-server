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
    // generateShareImage, // Функції генерації картинок (складніші)
    // generateRecommendationCard,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js'; // Захист всіх цих маршрутів

const router = express.Router();

// --- Профіль поточного користувача ---
router.route('/profile')
    .get(getUserProfile)     // GET /api/users/profile - Отримати свій профіль
    .put(updateUserProfile); // PUT /api/users/profile - Оновити свій профіль (включаючи налаштування приватності)

// --- Профіль іншого користувача (публічний/для друзів) ---
router.get('/:userId/profile', getUserPublicProfile); // GET /api/users/{userId}/profile

// --- Список перегляду іншого користувача ---
router.get('/:userId/watchlist', getFriendWatchlist); // GET /api/users/{userId}/watchlist

// --- Друзі ---
router.post('/friends/request/:userId', sendFriendRequest); // Надіслати запит
router.post('/friends/accept/:userId', acceptFriendRequest);  // Прийняти запит
router.delete('/friends/remove/:userId', rejectOrRemoveFriend); // Відхилити запит / Видалити друга
router.get('/friends', getFriends);                 // Отримати список друзів
router.get('/friends/requests', getFriendRequests); // Отримати список запитів у друзі

// --- Статистика ---
router.get('/stats', getUserStats); // GET /api/users/stats - Отримати статистику поточного користувача

// --- Генерація картинок (складніші, поки що можна закоментувати) ---
// router.get('/share/stats', generateShareImage);
// router.get('/share/recommendation/:watchlistItemId', generateRecommendationCard);

export default router;