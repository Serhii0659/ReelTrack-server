import express from 'express';
import {
    sendFriendRequest,
    acceptFriendRequest,
    rejectOrRemoveFriend,
    getFriends,
    getFriendRequests,
    getFriendWatchlist
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Отримати список друзів поточного користувача
router.get('/', protect, getFriends);

// Надіслати запит на додавання в друзі
router.post('/request/:userId', protect, sendFriendRequest);

// Отримати запити на додавання в друзі
router.get('/requests', protect, getFriendRequests);

// Прийняти запит на додавання в друзі
router.put('/request/:userId/accept', protect, acceptFriendRequest);

// Відхилити запит на додавання в друзі або видалити друга
router.put('/request/:userId/reject', protect, rejectOrRemoveFriend);
router.delete('/:userId', protect, rejectOrRemoveFriend);

// Отримати список перегляду друга
router.get('/:userId/watchlist', protect, getFriendWatchlist);

export default router;