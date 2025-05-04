import express from 'express';
import {
    addToWatchlist,
    getWatchlist,
    updateWatchlistItem,
    deleteWatchlistItem,
    getWatchlistItemDetails // Опціонально
} from '../controllers/watchlistController.js';

const router = express.Router();

// POST /api/watchlist - Додати новий елемент
router.post('/', addToWatchlist);

// GET /api/watchlist - Отримати весь список користувача (з фільтрацією/сортуванням)
router.get('/', getWatchlist);

// GET /api/watchlist/:id - Отримати деталі одного елемента списку (якщо потрібно)
// router.get('/:id', getWatchlistItemDetails);

// PUT /api/watchlist/:id - Оновити статус, оцінку, нотатки тощо
router.put('/:id', updateWatchlistItem);

// DELETE /api/watchlist/:id - Видалити елемент зі списку
router.delete('/:id', deleteWatchlistItem);

export default router;