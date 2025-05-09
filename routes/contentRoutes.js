// server\routes\contentRoutes.js
import express from 'express';
import { searchContent /*, getContentDetails */ } from '../controllers/contentController.js';
// TODO: Можливо, деякі маршрути контенту теж потребують захисту (protect)

const router = express.Router();

// Маршрут для пошуку контенту: GET /api/content/search?query=<search_term>
router.get('/search', searchContent);

// TODO: Маршрут для отримання деталей контенту за TMDB ID
// router.get('/:tmdbId/:mediaType', getContentDetails);


export default router;