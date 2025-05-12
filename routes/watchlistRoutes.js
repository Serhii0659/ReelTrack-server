import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    getWatchlist,
    updateWatchlistItem,
    deleteWatchlistItem,
    getWatchlistItemDetails,
    toggleWatchlistContent
} from '../controllers/watchlistController.js';

const router = express.Router();

router.get('/', protect, getWatchlist);
router.get('/:id', protect, getWatchlistItemDetails);
router.put('/:id', protect, updateWatchlistItem);
router.delete('/:id', protect, deleteWatchlistItem);
router.post('/toggle', protect, toggleWatchlistContent);

export default router;