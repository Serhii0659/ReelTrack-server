// server/routes/userRoutes.js

import express from 'express';
const router = express.Router();
import { protect } from '../middleware/authMiddleware.js';
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
    .put(protect, updateUserProfile);
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
