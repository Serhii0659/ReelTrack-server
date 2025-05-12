import express from 'express';
import { searchMediaController } from '../controllers/mediaController.js';

const router = express.Router();

router.get('/search', searchMediaController);

export default router;