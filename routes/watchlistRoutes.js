import express from 'express';
import { protect } from '../middleware/authMiddleware.js'; // ДОДАНО
import {
    addToWatchlist,
    getWatchlist,
    updateWatchlistItem,
    deleteWatchlistItem,
    getWatchlistItemDetails, // Опціонально
    toggleWatchlistContent // <--- ДОДАНО: Імпорт нової функції
} from '../controllers/watchlistController.js';

const router = express.Router();

// POST /api/watchlist - Додати новий елемент
router.post('/', protect, addToWatchlist); // ЗМІНЕНО

// GET /api/watchlist - Отримати весь список користувача (з фільтрацією/сортуванням)
router.get('/', protect, getWatchlist); // ЗМІНЕНО

// GET /api/watchlist/:id - Отримати деталі одного елемента списку (якщо потрібно)
// router.get('/:id', protect, getWatchlistItemDetails); // Якщо використовується, розкоментуйте і ДОДАЙТЕ 'protect'

// PUT /api/watchlist/:id - Оновити статус, оцінку, нотатки тощо
router.put('/:id', protect, updateWatchlistItem); // ЗМІНЕНО

// DELETE /api/watchlist/:id - Видалити елемент зі списку
router.delete('/:id', protect, deleteWatchlistItem); // ЗМІНЕНО

// POST /api/watchlist/toggle - Додати або видалити контент зі списку перегляду
router.post('/toggle', protect, toggleWatchlistContent); // <--- ДОДАНО НОВИЙ МАРШРУТ

export default router;