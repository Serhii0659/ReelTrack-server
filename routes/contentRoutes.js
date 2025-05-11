// server/routes/contentRoutes.js
import express from 'express';
import { 
    searchContent, 
    getDetailsByTmdbId,
    getReviewsForContent, 
    submitReview,
    getUserReviewForContent // <--- ДОДАНО: Імпорт нової функції контролера
} from '../controllers/contentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/search', searchContent);

router.get('/:mediaType/:tmdbId', getDetailsByTmdbId);

// --- МАРШРУТИ ДЛЯ ВІДГУКІВ ---
// GET всіх відгуків для певного контенту
router.get('/:mediaType/:tmdbId/reviews', getReviewsForContent);

// POST новий відгук для контенту (потребує авторизації)
router.post('/:mediaType/:tmdbId/reviews', protect, submitReview);

// PUT оновлення існуючого відгуку (потребує авторизації)
router.put('/:mediaType/:tmdbId/reviews/:reviewId', protect, submitReview);

// --- НОВИЙ МАРШРУТ: GET відгук поточного користувача для контенту ---
// Фронтенд запитує /api/content/:mediaType/:tmdbId/my-review
router.get('/:mediaType/:tmdbId/my-review', protect, getUserReviewForContent); // <--- ДОДАНО ЦЕЙ РЯДОК

// Опціонально: Маршрут для видалення відгуку
// router.delete('/:mediaType/:tmdbId/reviews/:reviewId', protect, deleteReview); // Розкоментуйте, якщо у вас є така функція

export default router;