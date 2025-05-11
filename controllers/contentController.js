// C:\Users\kreps\Documents\Projects\ReelTrack\server\controllers\contentController.js
import dotenv from 'dotenv';
// dotenv.config(); // Зазвичай dotenv.config() викликається один раз у server.js

import axios from 'axios'; // Імпортуємо axios
import asyncHandler from 'express-async-handler'; // Для спрощеної обробки помилок асинхронних функцій
import Review from '../models/reviewModel.js';   // Імпорт моделі відгуків
import User from '../models/User.js'; // Імпорт моделі користувача (потрібен для populate в submitReview та getReviewsForContent)
import WatchlistItem from '../models/WatchlistItem.js'; // <--- ВИПРАВЛЕНО ТУТ: назва файлу 'WatchlistItem.js'
import { getPosterUrl } from '../utils/tmdbHelper.js'; // Імпорт допоміжної функції для URL постера


const TMDB_API_KEY = process.env.TMDB_API_KEY; // Отримуємо ключ з .env
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'; // Базовий URL API TMDB

// Контролер для пошуку фільмів та серіалів
// @desc    Search for movies and TV shows on TMDB
// @route   GET /api/content/search
// @access  Public
const searchContent = asyncHandler(async (req, res) => {
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
                language: 'uk-UA', // Використовуємо українську мову
                include_adult: false // Виключаємо контент для дорослих
            }
        });

        // Фільтруємо результати, залишаючи лише фільми та серіали, які мають постер
        const filteredResults = response.data.results.filter(
            item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path
        );

        // Трансформуємо результати у зручний формат
        const transformedResults = filteredResults.map(item => ({
            tmdbId: item.id, // ID з TMDB
            title: item.title || item.name, // Назва (для фільмів - title, для серіалів - name)
            overview: item.overview, // Опис
            posterPath: item.poster_path, // Шлях до постера
            mediaType: item.media_type, // Тип медіа (movie або tv)
            releaseDate: item.release_date || item.first_air_date, // Дата релізу
            voteAverage: item.vote_average, // Середня оцінка TMDB
        }));

        res.json(transformedResults); // Відправляємо трансформовані результати

    } catch (error) {
        console.error("Error searching TMDB:", error.response?.data?.status_message || error.message);
        if (error.response) {
            // Якщо помилка прийшла від TMDB API (наприклад, невірна конфігурація ключа, 401, 429)
            res.status(error.response.status); // Встановлюємо статус помилки з відповіді TMDB
            throw new Error(error.response.data.status_message || 'Error fetching from TMDB API');
        } else {
            // Інші помилки (наприклад, проблема з мережею)
            res.status(500);
            throw new Error('Error searching content');
        }
    }
});

// Контролер для отримання деталей фільму/серіалу за TMDB ID
// @desc    Get content details by TMDB ID
// @route   GET /api/content/:mediaType/:tmdbId
// @access  Public
const getDetailsByTmdbId = asyncHandler(async (req, res) => {
    const { mediaType, tmdbId } = req.params;

    console.log(`[Backend Trace] Received request for content: Type=${mediaType}, ID=${tmdbId}`);

    // Валідація вхідних параметрів
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
        // Формуємо URL для запиту до TMDB API
        const tmdbApiUrl = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,recommendations,reviews&language=uk-UA`;

        console.log(`[Backend Trace] Calling TMDB API: ${tmdbApiUrl}`);

        // Виконуємо запит до TMDB
        const response = await axios.get(tmdbApiUrl);

        console.log(`[Backend Trace] TMDB API Response Status: ${response.status}`);
        // console.log(`[Backend Trace] TMDB API Response Data (first 100 chars): ${JSON.stringify(response.data).substring(0, 100)}...`); // Закоментовано, щоб не логувати багато даних


        // --- ПОКРАЩЕНА ОБРОБКА ПОМИЛОК ВІД TMDB API ---
        // TMDB повертає status_code 34, якщо ресурс не знайдено
        if (response.data && response.data.status_code === 34) {
            console.warn(`[Backend Trace] TMDB responded with 'resource not found' (status_code 34) for ${mediaType} ID ${tmdbId}.`);
            // Явно відправляємо відповідь 404 Not Found
            return res.status(404).json({ message: 'Content not found on TMDB.' });
        }
        // --- КІНЕЦЬ ПОКРАЩЕНОЇ ОБРОБКИ ---


        res.status(200).json(response.data); // Успішна відповідь з даними від TMDB

    } catch (error) {
        console.error(`[Backend Trace] Error fetching ${mediaType} details from TMDB for ID ${tmdbId}:`, error.message);

        if (error.response) {
            // Якщо помилка прийшла від TMDB API (наприклад, 404, 401, 429)
            console.error('[Backend Trace] TMDB API Error Response Data:', error.response.data);
            // Явно відправляємо відповідь з оригінальним статусом та повідомленням від TMDB
            return res.status(error.response.status).json({
                message: error.response.data.status_message || `Failed to fetch content details from TMDB. Status: ${error.response.status}`
            });

        } else if (error.request) {
            // Якщо запит був зроблений, але відповіді не отримано (наприклад, проблема з мережею)
            res.status(500);
            throw new Error('No response from TMDB API. Check network connection or TMDB API status.');

        } else {
            // Інші помилки при налаштуванні запиту
            res.status(500);
            throw new Error('An unexpected error occurred while preparing the TMDB request.');
        }
    }
});


// Контролер для отримання всіх відгуків для певного контенту
// @desc    Отримати всі відгуки для певного контенту
// @route   GET /api/content/:mediaType/:tmdbId/reviews
// @access  Public (або Private, якщо ти хочеш обмежити видимість відгуків)
const getReviewsForContent = asyncHandler(async (req, res) => {
    const { mediaType, tmdbId } = req.params;

    // Знаходимо всі відгуки для цього контенту та завантажуємо інформацію про рецензента
    const reviews = await Review.find({ mediaType, tmdbId })
                                .populate('reviewer', 'name avatarUrl') // populate 'name' та 'avatarUrl' з моделі User
                                .sort({ createdAt: -1 }); // Сортуємо за датою створення (новіші перші)

    res.json(reviews);
});

// Контролер для надсилання або оновлення відгуку
// @desc    Надіслати або оновити відгук для певного контенту
// @route   POST /api/content/:mediaType/:tmdbId/reviews (створення)
// @route   PUT /api/content/:mediaType/:tmdbId/reviews/:reviewId (оновлення)
// @access  Private (користувач повинен бути автентифікований)
const submitReview = asyncHandler(async (req, res) => {
    const { mediaType, tmdbId, reviewId } = req.params;
    // Отримуємо дані відгуку з тіла запиту
    const { rating, comment, contentTitle, contentPosterPath } = req.body;

    // Лог для перевірки отриманих даних на бекенді
    console.log('Backend (submitReview): Отримано запит на відгук.');
    console.log('Backend (submitReview): Params:', { mediaType, tmdbId, reviewId });
    console.log('Backend (submitReview): Body:', { rating, comment, contentTitle, contentPosterPath });


    // Перевіряємо, чи користувач автентифікований
    // `req.user` зазвичай встановлюється middleware авторизації (`protect`)
    if (!req.user || !req.user._id) {
        res.status(401);
        throw new Error('Не авторизовано, немає токена користувача.');
    }

    // Перевіряємо валідність оцінки
    // Дозволяємо 0, якщо це без оцінки. Перевіряємо, що це число і в межах [0, 10].
    if (typeof rating !== 'number' || rating < 0 || rating > 10) {
        res.status(400);
        throw new Error('Оцінка є обов\'язковою і повинна бути числом від 0 до 10.');
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

        // Оновлюємо поля відгуку
        review.rating = rating;
        review.comment = comment || ''; // Коментар може бути порожнім

        const updatedReview = await review.save();

        // Завантажуємо інформацію про рецензента для відповіді
        await updatedReview.populate('reviewer', 'name avatarUrl'); // populate 'name' та 'avatarUrl' з моделі User

        res.status(200).json({ message: 'Відгук успішно оновлено!', review: updatedReview }); // статус 200 та повертаємо об'єкт review

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

        // Створюємо новий відгук
        review = new Review({
            reviewer: req.user._id,
            mediaType,
            tmdbId,
            rating,
            comment: comment || '',
            contentTitle: contentTitle, // Зберігаємо contentTitle
            contentPosterPath: contentPosterPath, // Зберігаємо contentPosterPath
        });

        const createdReview = await review.save();

        // Завантажуємо інформацію про рецензента для відповіді
        await createdReview.populate('reviewer', 'name avatarUrl'); // populate 'name' та 'avatarUrl' з моделі User

        res.status(201).json({ message: 'Відгук успішно надіслано!', review: createdReview }); // повертаємо об'єкт review
    }
});

// НОВА ФУНКЦІЯ: Отримати відгук поточного користувача для певного контенту
// @desc    Get current user's review for a specific content item
// @route   GET /api/content/:mediaType/:tmdbId/my-review
// @access  Private
const getUserReviewForContent = asyncHandler(async (req, res) => {
    const { mediaType, tmdbId } = req.params;

    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Не авторизовано, користувач не знайдений.' });
    }

    const review = await Review.findOne({
        reviewer: req.user._id, // Зверніть увагу: ім'я поля 'reviewer' у вашій моделі Review
        mediaType: mediaType,
        tmdbId: tmdbId,
    });

    if (!review) {
        // Якщо відгук не знайдено, повертаємо 200 OK з null. Фронтенд очікує null, якщо відгуку немає.
        return res.status(200).json(null);
    }

    // Якщо відгук знайдено, повертаємо його
    res.status(200).json(review);
});


// Контролер для отримання відгуків та оцінок, залишених поточним користувачем.
// @desc    Get current user's reviews and ratings
// @route   GET /api/users/my-reviews
// @access  Private
const getUserReviews = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Find all reviews left by this user
    const reviews = await Review.find({ reviewer: userId })
        // Populate reviewer info if needed, though it's always the current user here
        // .populate('reviewer', 'name avatarUrl') // Optional: populate reviewer data
        .sort({ createdAt: -1 }); // Sort by creation date (newest first)

    // Add full poster URLs to the reviews
    const reviewsWithPosterUrls = reviews.map(review => {
        const reviewObject = review.toObject(); // Convert Mongoose document to plain object
        // Add full poster URL if contentPosterPath is stored in the Review model
        // and getPosterUrl function is available
        if (reviewObject.contentPosterPath) {
             reviewObject.poster_full_url = getPosterUrl(reviewObject.contentPosterPath);
        }
        return reviewObject;
    });


    res.json(reviewsWithPosterUrls);
});


// @desc    Add content to user's library (using WatchlistItem model)
// @route   POST /api/users/library/add
// @access  Private
const addContentToLibrary = asyncHandler(async (req, res) => {
    console.log('User in addContentToLibrary controller:', req.user);
    const { tmdbId, mediaType, status, title, posterPath, releaseDate, genres } = req.body;

    if (!tmdbId || !mediaType || !title || !posterPath) {
        res.status(400);
        throw new Error('TMDB ID, media type, title, and poster path are required.');
    }

    const userId = req.user._id; // Ensure req.user._id is available (user is authenticated)

    // Check if content already exists in the user's Watchlist
    const existingItem = await WatchlistItem.findOne({
        user: userId,
        externalId: String(tmdbId), // Important: compare with externalId
        mediaType: mediaType,
    });

    if (existingItem) {
        res.status(400);
        throw new Error('Content already exists in your library.');
    }

    // === ДОДАНО: Створення нового WatchlistItem та його збереження ===
    const newItem = new WatchlistItem({
        user: userId,
        externalId: String(tmdbId), // TMDB ID is stored as externalId (convert to String as per schema)
        mediaType,
        title,
        posterPath,
        releaseDate,
        genres,
        status, // Use the status received from the frontend (now it's 'plan_to_watch')
        // Add other fields you want to save, e.g.:
        // originalTitle: req.body.originalTitle,
        // overview: req.body.overview,
        // language: req.body.language,
        // runtime: req.body.runtime,
        // userNotes: req.body.userNotes,
        // userRating: req.body.userRating,
        // episodesWatched: req.body.episodesWatched,
        // totalEpisodes: req.body.totalEpisodes,
        // totalSeasons: req.body.totalSeasons,
    });

    const createdItem = await newItem.save();

    // Відповідь клієнту про успішне додавання
    res.status(201).json({
        message: 'Контент успішно додано до бібліотеки!',
        item: createdItem,
    });
});


// --- Генерація Картинок (складно, вимагає додаткових бібліотек) ---
// Stubs for functions, implementation requires 'canvas' or 'puppeteer'
/*
export const generateShareImage = asyncHandler(async (req, res) => {
    // 1. Get user stats (call getUserStats or similar logic)
    // 2. Use a library like 'canvas' or 'puppeteer' to render stats on a background image/template
    // 3. Set the correct Content-Type ('image/png' або 'image/jpeg')
    // 4. Send the generated image in the response (res.send(buffer) або res.sendFile(path))
    res.status(501).json({ message: 'Image generation not implemented yet' });
});

export const generateRecommendationCard = asyncHandler(async (req, res) => {
     // 1. Get the item ID from req.params.watchlistItemId
     // 2. Find this item in the database WatchlistItem.findById(...)
     // 3. Check if it belongs to the user req.user._id
     // 4. Get data (poster, title, description, user rating)
     // 5. Use a library to generate the card image
     // 6. Send the image
     res.status(501).json({ message: 'Recommendation card generation not implemented yet' });
});
*/

// --- TODO: Recommendations (very complex, optional) ---
// --- TODO: Reminders (requires a task scheduler/cron) ---


// Експортуємо функції контролера
export {
    searchContent,
    getDetailsByTmdbId,
    getReviewsForContent,
    submitReview,
    getUserReviewForContent,
    getUserReviews,
    addContentToLibrary,
};