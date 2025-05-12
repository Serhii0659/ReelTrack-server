import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
    deleteReview,
} from '../controllers/userController.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/avatars/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 1024 * 1024 * 5 },
    fileFilter: (req, file, cb) => {
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

// Profile routes
router.route('/profile')
    .get(protect, getUserProfile)
    .put(protect, upload.single('avatar'), updateUserProfile);

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
router.post('/library/add', protect, addContentToLibrary);

// Stats and reviews
router.get('/stats', protect, getUserStats);
router.get('/my-reviews', protect, getUserReviews);
router.delete('/my-reviews/:reviewId', protect, deleteReview);

// User search
router.get('/search', protect, searchUsers);

export default router;
