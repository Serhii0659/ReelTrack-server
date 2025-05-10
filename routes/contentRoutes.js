// server\routes\contentRoutes.js
import express from 'express';
import { searchContent, getDetailsByTmdbId } from '../controllers/contentController.js'; // << Тут має бути getDetailsByTmdbId

const router = express.Router();

router.get('/search', searchContent);

// ЦЕЙ РЯДОК ТРЕБА ВИПРАВИТИ:
router.get('/details/:mediaType/:tmdbId', getDetailsByTmdbId); // << Змінили назву функції та порядок параметрів
// ЗВЕРНИ УВАГУ: Шлях теж змінено на '/details/:mediaType/:tmdbId'
// щоб він відповідав клієнтському запиту `/api/content/details/<span class="math-inline">\{mediaType\}/</span>{tmdbId}`

export default router;