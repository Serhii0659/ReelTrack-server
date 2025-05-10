import express from 'express';
import { searchMediaController } from '../controllers/mediaController.js';

const router = express.Router();

// GET /api/media/search?query=...&type=...
router.get('/search', searchMediaController);

export default router;