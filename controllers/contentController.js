// C:\Users\kreps\Documents\Projects\ReelTrack\server\controllers\contentController.js
import dotenv from 'dotenv';
dotenv.config(); // Завантажуємо змінні середовища на початку (хоча зазвичай це робиться в server.js один раз)

import axios from 'axios'; // Імпортуємо axios
import asyncHandler from 'express-async-handler'; // <--- ДОДАНО: Для спрощеної обробки помилок асинхронних функцій
import Review from '../models/reviewModel.js';   // <--- ДОДАНО: Імпорт моделі відгуків

const TMDB_API_KEY = process.env.TMDB_API_KEY; // Отримуємо ключ з .env
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'; // Базовий URL API TMDB

// Контролер для пошуку фільмів та серіалів
// ВИПРАВЛЕНО: Прибрано export перед функцією searchContent
const searchContent = asyncHandler(async (req, res) => { // <--- ОБГОРНУТО asyncHandler
    const searchQuery = req.query.query;

    if (!searchQuery) {
        res.status(400); // Встановлюємо статус 400
        throw new Error('Search query is required'); // Кидаємо помилку для обробки asyncHandler
    }

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/search/multi`, {
            params: {
                api_key: TMDB_API_KEY,
                query: searchQuery,
                language: 'uk-UA',
                include_adult: false
            }
        });

        const filteredResults = response.data.results.filter(
            item => item.media_type === 'movie' || item.media_type === 'tv'
        );

        const transformedResults = filteredResults.map(item => ({
            tmdbId: item.id,
            title: item.title || item.name,
            overview: item.overview,
            posterPath: item.poster_path,
            mediaType: item.media_type,
            releaseDate: item.release_date || item.first_air_date,
            voteAverage: item.vote_average,
        }));

        res.json(transformedResults);

    } catch (error) {
        console.error("Error searching TMDB:", error.response?.data?.status_message || error.message);
        if (error.response) {
            // Якщо помилка прийшла від TMDB API (наприклад, невірна конфігурація ключа)
            res.status(error.response.status); // Встановлюємо статус помилки з відповіді TMDB
            throw new Error(error.response.data.status_message || 'Error fetching from TMDB API');
        } else {
            // Інші помилки
            res.status(500);
            throw new Error('Error searching content');
        }
    }
});

// Контролер для отримання деталей фільму/серіалу за TMDB ID
// ВИПРАВЛЕНО: Прибрано export перед функцією getDetailsByTmdbId
const getDetailsByTmdbId = asyncHandler(async (req, res) => { // <--- ОБГОРНУТО asyncHandler
    const { mediaType, tmdbId } = req.params;

    console.log(`[Backend Trace] Received request for content: Type=${mediaType}, ID=${tmdbId}`);

    if (!mediaType || !tmdbId) {
        console.log('[Backend Trace] Validation failed: Missing mediaType or tmdbId.');
        res.status(400);
        throw new Error('Media type and TMDB ID are required.');
    }

    if (mediaType !== 'movie' && mediaType !== 'tv') {
        console.log('[Backend Trace] Validation failed: Invalid mediaType.');
        res.status(400);
        throw new Error('Invalid media type. Must be "movie" or "tv".');
    }

    try {
        // Додаємо &language=uk-UA до URL
        const tmdbApiUrl = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,recommendations,reviews&language=uk-UA`;

        console.log(`[Backend Trace] Calling TMDB API: ${tmdbApiUrl}`);

        const response = await axios.get(tmdbApiUrl);

        console.log(`[Backend Trace] TMDB API Response Status: ${response.status}`);
        console.log(`[Backend Trace] TMDB API Response Data (first 100 chars): ${JSON.stringify(response.data).substring(0, 100)}...`);

        if (response.data.status_code === 34) {
            console.warn(`[Backend Trace] TMDB responded with 'resource not found' (status_code 34) for ${mediaType} ID ${tmdbId}.`);
            res.status(404);
            throw new Error('Content not found on TMDB.');
        }
        
        res.status(200).json(response.data);

    } catch (error) {
        console.error(`[Backend Trace] Error fetching ${mediaType} details from TMDB for ID ${tmdbId}:`, error.message);
        if (error.response) {
            console.error('[Backend Trace] TMDB API Error Response Data:', error.response.data);
            res.status(error.response.status);
            throw new Error(error.response.data.status_message || 'Failed to fetch content details from TMDB.');
        } else if (error.request) {
            res.status(500);
            throw new Error('No response from TMDB API. Check network connection or TMDB API status.');
        } else {
            res.status(500);
            throw new Error('An unexpected error occurred while preparing the TMDB request.');
        }
    }
});


// <--- Контролер для отримання всіх відгуків для певного контенту ---
// @desc    Отримати всі відгуки для певного контенту
// @route   GET /api/content/:mediaType/:tmdbId/reviews
// @access  Public (або Private, якщо ти хочеш обмежити видимість відгуків)
// ВИПРАВЛЕНО: Прибрано export перед функцією getReviewsForContent
const getReviewsForContent = asyncHandler(async (req, res) => {
    const { mediaType, tmdbId } = req.params;

    const reviews = await Review.find({ mediaType, tmdbId })
                                .populate('reviewer', 'username avatar') // ВИПРАВЛЕНО: Завантажуємо username та avatar
                                .sort({ createdAt: -1 }); // Сортуємо за датою створення (новіші перші)

    res.json(reviews);
});

// <--- Контролер для надсилання або оновлення відгуку ---
// @desc    Надіслати або оновити відгук для певного контенту
// @route   POST /api/content/:mediaType/:tmdbId/reviews (створення)
// @route   PUT /api/content/:mediaType/:tmdbId/reviews/:reviewId (оновлення)
// @access  Private (користувач повинен бути автентифікований)
// ВИПРАВЛЕНО: Прибрано export перед функцією submitReview
const submitReview = asyncHandler(async (req, res) => {
    const { mediaType, tmdbId, reviewId } = req.params;
    // --- ВИПРАВЛЕНО: Отримуємо contentTitle та contentPosterPath з тіла запиту ---
    const { rating, comment, contentTitle, contentPosterPath } = req.body;
    // --- ---

    // --- ДОДАНО: Лог для перевірки отриманих даних на бекенді ---
    console.log('Backend (submitReview): Отримано запит на відгук.');
    console.log('Backend (submitReview): Params:', { mediaType, tmdbId, reviewId });
    console.log('Backend (submitReview): Body:', { rating, comment, contentTitle, contentPosterPath });
    // --- ---

    // Перевіряємо, чи користувач автентифікований
    // `req.user` зазвичай встановлюється middleware авторизації (наприклад, `protect`)
    if (!req.user || !req.user._id) {
        res.status(401);
        throw new Error('Не авторизовано, немає токена користувача.');
    }

    if (!rating || rating < 1 || rating > 10) {
        res.status(400);
        throw new Error('Оцінка є обов\'язковою і повинна бути від 1 до 10.');
    }

    let review;
    if (reviewId) {
        // Якщо reviewId присутній, це оновлення існуючого відгуку
        review = await Review.findById(reviewId);

        if (!review) {
            res.status(404);
            throw new Error('Відгук не знайдено.');
        }

        // Переконуємося, що користувач є власником відгуку
        if (review.reviewer.toString() !== req.user._id.toString()) {
            res.status(403); // Forbidden
            throw new Error('Користувач не має прав для оновлення цього відгуку.');
        }

        review.rating = rating;
        review.comment = comment || ''; // Коментар може бути порожнім
        // ВИПРАВЛЕНО: Не оновлюємо contentTitle та contentPosterPath при оновленні відгуку
        // review.contentTitle = contentTitle;
        // review.contentPosterPath = contentPosterPath;

        const updatedReview = await review.save();

        // Завантажуємо інформацію про рецензента для відповіді
        await updatedReview.populate('reviewer', 'name avatar'); // ВИПРАВЛЕНО: populate 'name avatar'

        res.status(200).json({ message: 'Відгук успішно оновлено!', review: updatedReview }); // ВИПРАВЛЕНО: статус 200 та повертаємо об'єкт review

    } else {
        // Якщо reviewId відсутній, це створення нового відгуку
        // Перевіряємо, чи користувач вже залишав відгук до цього контенту
        const existingReview = await Review.findOne({
            reviewer: req.user._id,
            mediaType,
            tmdbId,
        });

        if (existingReview) {
            res.status(400);
            throw new Error('Ви вже залишали відгук до цього контенту. Будь ласка, відредагуйте існуючий відгук.');
        }

        review = new Review({
            reviewer: req.user._id,
            mediaType,
            tmdbId,
            rating,
            comment: comment || '',
            contentTitle: contentTitle, // <--- Зберігаємо contentTitle
            contentPosterPath: contentPosterPath, // <--- Зберігаємо contentPosterPath
        });

        const createdReview = await review.save();

        // Завантажуємо інформацію про рецензента для відповіді
        await createdReview.populate('reviewer', 'name avatar'); // ВИПРАВЛЕНО: populate 'name avatar'

        res.status(201).json({ message: 'Відгук успішно надіслано!', review: createdReview }); // ВИПРАВЛЕНО: повертаємо об'єкт review
    }
});


// Експортуємо функції контролера
export {
    searchContent, // ВИПРАВЛЕНО: Експортуємо searchContent
    getDetailsByTmdbId, // ВИПРАВЛЕНО: Експортуємо getDetailsByTmdbId
    getReviewsForContent, // ВИПРАВЛЕНО: Експортуємо getReviewsForContent
    submitReview, // Експортуємо submitReview
    // Експортуйте інші функції, якщо вони є в цьому файлі
};



