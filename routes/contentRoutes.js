// C:\Users\kreps\Documents\Projects\ReelTrack\server\routes\contentRoutes.js
import express from 'express';
import { 
    searchContent, 
    getDetailsByTmdbId,
    getReviewsForContent, // <--- ДОДАНО: Імпорт функції для отримання відгуків
    submitReview          // <--- ДОДАНО: Імпорт функції для надсилання/оновлення відгуків
} from '../controllers/contentController.js';
import { protect } from '../middleware/authMiddleware.js'; // <--- ДОДАНО: Імпорт middleware для захисту маршрутів

const router = express.Router();

router.get('/search', searchContent);

// ВИПРАВЛЕННЯ: Шлях змінено на кореневий для router, щоб відповідати запиту фронтенду
// Це означає, що при підключенні в server.js як /api/content, повний шлях буде /api/content/:mediaType/:tmdbId
router.get('/:mediaType/:tmdbId', getDetailsByTmdbId); // ВИДАЛЕНО '/details' з маршруту

// --- НОВІ МАРШРУТИ ДЛЯ ВІДГУКІВ ---
// GET всіх відгуків для певного контенту
router.get('/:mediaType/:tmdbId/reviews', getReviewsForContent);

// POST новий відгук для контенту (потребує авторизації)
router.post('/:mediaType/:tmdbId/reviews', protect, submitReview);

// PUT оновлення існуючого відгуку (потребує авторизації)
router.put('/:mediaType/:tmdbId/reviews/:reviewId', protect, submitReview);

// Опціонально: Маршрут для видалення відгуку (якщо буде потрібно)
// router.delete('/:mediaType/:tmdbId/reviews/:reviewId', protect, deleteReview);

export default router;