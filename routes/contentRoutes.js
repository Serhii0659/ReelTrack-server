import express from 'express';
import { 
    searchContent, 
    getDetailsByTmdbId,
    getReviewsForContent, 
    submitReview,
    getUserReviewForContent
} from '../controllers/contentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/search', searchContent);
router.get('/:mediaType/:tmdbId', getDetailsByTmdbId);

// Відгуки
router.get('/:mediaType/:tmdbId/reviews', getReviewsForContent);
router.post('/:mediaType/:tmdbId/reviews', protect, submitReview);
router.put('/:mediaType/:tmdbId/reviews/:reviewId', protect, submitReview);
router.get('/:mediaType/:tmdbId/my-review', protect, getUserReviewForContent);

export default router;