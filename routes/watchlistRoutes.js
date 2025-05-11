// server/routes/watchlistRoutes.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    // addToWatchlist, // <--- ВИДАЛЕНО: Ця функція не експортується з контролера.
    getWatchlist,
    updateWatchlistItem,
    deleteWatchlistItem,
    getWatchlistItemDetails, // Опціонально
    toggleWatchlistContent // <--- Ця функція імпортована і буде використовуватися для додавання/видалення
} from '../controllers/watchlistController.js';

const router = express.Router();

// *** ЗВЕРНІТЬ УВАГУ: Старий маршрут для додавання ЗАКОМЕНТОВАНО/ВИДАЛЕНО. ***
// POST /api/watchlist - Додати новий елемент (Цей маршрут більше не потрібен, якщо використовується /toggle)
// router.post('/', protect, addToWatchlist); // <-- ЗАКОМЕНТОВАНО або ВИДАЛЕНО!

// GET /api/watchlist - Отримати весь список користувача (з фільтрацією/сортуванням)
router.get('/', protect, getWatchlist);

// GET /api/watchlist/:id - Отримати деталі одного елемента списку (якщо потрібно)
router.get('/:id', protect, getWatchlistItemDetails); // Розкоментовано, якщо ви його використовуєте. Переконайтесь, що він потрібен.

// PUT /api/watchlist/:id - Оновити статус, оцінку, нотатки тощо
router.put('/:id', protect, updateWatchlistItem);

// DELETE /api/watchlist/:id - Видалити елемент зі списку
router.delete('/:id', protect, deleteWatchlistItem);

// POST /api/watchlist/toggle - Додати або видалити контент зі списку перегляду (Основний маршрут для маніпуляцій)
router.post('/toggle', protect, toggleWatchlistContent);

export default router;