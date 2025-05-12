import axios from 'axios'; // Імпортуємо axios
import asyncHandler from 'express-async-handler'; // Для спрощеної обробки помилок асинхронних функцій
import Review from '../models/reviewModel.js';   // Імпорт моделі відгуків
import WatchlistItem from '../models/WatchlistItem.js'; // <--- ВИПРАВЛЕНО ТУТ: назва файлу 'WatchlistItem.js'
import { getPosterUrl } from '../utils/tmdbHelper.js'; // Імпорт допоміжної функції для URL постера

const TMDB_API_KEY = process.env.TMDB_API_KEY; // Отримуємо ключ з .env
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'; // Базовий URL API TMDB

// Пошук фільмів та серіалів на TMDB
const searchContent = asyncHandler(async (req, res) => {
    const searchQuery = req.query.query;
    if (!searchQuery) {
        res.status(400);
        throw new Error('Search query is required');
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
            item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path
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
            res.status(error.response.status);
            throw new Error(error.response.data.status_message || 'Error fetching from TMDB API');
        } else {
            res.status(500);
            throw new Error('Error searching content');
        }
    }
});

// Деталі фільму/серіалу за TMDB ID
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
        const tmdbApiUrl = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,recommendations,reviews&language=uk-UA`;
        const response = await axios.get(tmdbApiUrl);
        if (response.data && response.data.status_code === 34) {
            return res.status(404).json({ message: 'Content not found on TMDB.' });
        }
        res.status(200).json(response.data);
    } catch (error) {
        if (error.response) {
            return res.status(error.response.status).json({
                message: error.response.data.status_message || `Failed to fetch content details from TMDB. Status: ${error.response.status}`
            });
        } else if (error.request) {
            res.status(500);
            throw new Error('No response from TMDB API. Check network connection or TMDB API status.');
        } else {
            res.status(500);
            throw new Error('An unexpected error occurred while preparing the TMDB request.');
        }
    }
});

// Всі відгуки для певного контенту
const getReviewsForContent = asyncHandler(async (req, res) => {
    const { mediaType, tmdbId } = req.params;
    const reviews = await Review.find({ mediaType, tmdbId })
        .populate('reviewer', 'name avatarUrl')
        .sort({ createdAt: -1 });
    res.json(reviews);
});

// Надіслати або оновити відгук
const submitReview = asyncHandler(async (req, res) => {
    const { mediaType, tmdbId, reviewId } = req.params;
    const { rating, comment, contentTitle, contentPosterPath } = req.body;
    if (!req.user || !req.user._id) {
        res.status(401);
        throw new Error('Не авторизовано, немає токена користувача.');
    }
    if (typeof rating !== 'number' || rating < 0 || rating > 10) {
        res.status(400);
        throw new Error('Оцінка є обов\'язковою і повинна бути числом від 0 до 10.');
    }
    let review;
    if (reviewId) {
        review = await Review.findById(reviewId);
        if (!review) {
            res.status(404);
            throw new Error('Відгук не знайдено.');
        }
        if (review.reviewer.toString() !== req.user._id.toString()) {
            res.status(403);
            throw new Error('Користувач не має прав для оновлення цього відгуку.');
        }
        review.rating = rating;
        review.comment = comment || '';
        const updatedReview = await review.save();
        await updatedReview.populate('reviewer', 'name avatarUrl');
        res.status(200).json({ message: 'Відгук успішно оновлено!', review: updatedReview });
    } else {
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
            contentTitle,
            contentPosterPath,
        });
        const createdReview = await review.save();
        await createdReview.populate('reviewer', 'name avatarUrl');
        res.status(201).json({ message: 'Відгук успішно надіслано!', review: createdReview });
    }
});

// Відгук поточного користувача для певного контенту
const getUserReviewForContent = asyncHandler(async (req, res) => {
    const { mediaType, tmdbId } = req.params;
    if (!req.user || !req.user._id) {
        return res.status(401).json({ message: 'Не авторизовано, користувач не знайдений.' });
    }
    const review = await Review.findOne({
        reviewer: req.user._id,
        mediaType,
        tmdbId,
    });
    if (!review) {
        return res.status(200).json(null);
    }
    res.status(200).json(review);
});

// Всі відгуки та оцінки поточного користувача
const getUserReviews = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const reviews = await Review.find({ reviewer: userId })
        .sort({ createdAt: -1 });
    const reviewsWithPosterUrls = reviews.map(review => {
        const reviewObject = review.toObject();
        if (reviewObject.contentPosterPath) {
            reviewObject.poster_full_url = getPosterUrl(reviewObject.contentPosterPath);
        }
        return reviewObject;
    });
    res.json(reviewsWithPosterUrls);
});

// Додати контент до бібліотеки користувача
const addContentToLibrary = asyncHandler(async (req, res) => {
    const { tmdbId, mediaType, status, title, posterPath, releaseDate, genres } = req.body;
    if (!tmdbId || !mediaType || !title || !posterPath) {
        res.status(400);
        throw new Error('TMDB ID, media type, title, and poster path are required.');
    }
    const userId = req.user._id;
    const existingItem = await WatchlistItem.findOne({
        user: userId,
        externalId: String(tmdbId),
        mediaType,
    });
    if (existingItem) {
        res.status(400);
        throw new Error('Content already exists in your library.');
    }
    const newItem = new WatchlistItem({
        user: userId,
        externalId: String(tmdbId),
        mediaType,
        title,
        posterPath,
        releaseDate,
        genres,
        status,
    });
    const createdItem = await newItem.save();
    res.status(201).json({
        message: 'Контент успішно додано до бібліотеки!',
        item: createdItem,
    });
});

export {
    searchContent,
    getDetailsByTmdbId,
    getReviewsForContent,
    submitReview,
    getUserReviewForContent,
    getUserReviews,
    addContentToLibrary,
};