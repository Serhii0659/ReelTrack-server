// \server\controllers\watchlistController.js
import WatchlistItem from '../models/WatchlistItem.js';
import User from '../models/User.js'; // Може знадобитися для перевірки приватності
import { getMediaDetails, getPosterUrl } from '../utils/tmdbHelper.js'; // Потрібен для отримання деталей перед додаванням
import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';

// --- Додавання елемента до списку (Ця функція, можливо, більше не потрібна, якщо використовується toggleWatchlistContent) ---
/*
export const addToWatchlist = asyncHandler(async (req, res) => {
    console.log('Backend (addToWatchlist): Отримано запит на додавання до списку перегляду.');
    console.log('Backend (addToWatchlist): Повне тіло запиту (req.body):', req.body);

    const { tmdbId, mediaType, status } = req.body;
    const userId = req.user._id;

    console.log('Backend (addToWatchlist): Видобуто tmdbId:', tmdbId);
    console.log('Backend (addToWatchlist): Видобуто mediaType:', mediaType);

    if (!tmdbId || !mediaType) {
        return res.status(400).json({ message: 'External ID and media type are required' });
    }
    if (!['movie', 'tv'].includes(mediaType)) {
        return res.status(400).json({ message: 'Invalid media type' });
    }

    try {
        const existingItem = await WatchlistItem.findOne({ user: userId, externalId: tmdbId.toString(), mediaType });
        if (existingItem) {
            return res.status(400).json({ message: 'Item already exists in your watchlist' });
        }

        // Отримуємо деталі з TMDB, щоб зберегти основну інформацію
        console.log(`Backend (addToWatchlist): Запит деталей з TMDB для ID: ${tmdbId}, Тип: ${mediaType}`);
        const details = await getMediaDetails(tmdbId, mediaType);
        console.log(`Backend (addToWatchlist): Відповідь TMDB details:`, details);

        if (!details) {
            return res.status(404).json({ message: 'Media not found on external service' });
        }

        const newItem = new WatchlistItem({
            user: userId,
            externalId: tmdbId.toString(),
            mediaType,
            title: details.title || details.name,
            originalTitle: details.original_title || details.original_name,
            posterPath: details.poster_path,
            releaseDate: details.release_date || details.first_air_date,
            overview: details.overview,
            genres: details.genres?.map(g => g.name) || [],
            language: details.original_language,
            runtime: mediaType === 'movie' ? details.runtime : null,
            totalEpisodes: mediaType === 'tv' ? details.number_of_episodes : null,
            totalSeasons: mediaType === 'tv' ? details.number_of_seasons : null,
            status: status || 'plan_to_watch',
        });

        await newItem.save();

        const itemWithPoster = newItem.toObject();
        itemWithPoster.poster_full_url = getPosterUrl(itemWithPoster.posterPath);

        res.status(201).json(itemWithPoster);

    } catch (error) {
        console.error("Add to watchlist error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Item already seems to exist in your watchlist.' });
        }
        res.status(500).json({ message: 'Error adding item to watchlist', error: error.message });
    }
});
*/

// --- Отримання списку перегляду користувача ---
// @desc    Get current user's watchlist
// @route   GET /api/watchlist
// @access  Private
// ЗМІНЕНО: Вилучено 'export' звідси, оскільки воно вже експортується в кінці файлу
const getWatchlist = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { status, sortBy, sortOrder = 'desc', page = 1, limit = 20 } = req.query;

    const query = { user: userId };
    if (status) {
        query.status = status;
    }

    const sortOptions = {};
    if (sortBy) {
        const allowedSortFields = ['createdAt', 'updatedAt', 'dateCompleted', 'userRating', 'releaseDate', 'title'];
        if (allowedSortFields.includes(sortBy)) {
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
        } else {
            return res.status(400).json({ message: `Sorting by '${sortBy}' is not allowed.` });
        }
    } else {
        sortOptions.updatedAt = -1;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    try {
        const items = await WatchlistItem.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum)
            .lean();

        const itemsWithPoster = items.map(item => ({
            ...item,
            poster_full_url: getPosterUrl(item.posterPath)
        }));

        const totalItems = await WatchlistItem.countDocuments(query);

        res.json({
            items: itemsWithPoster,
            currentPage: pageNum,
            totalPages: Math.ceil(totalItems / limitNum),
            totalItems
        });
    } catch (error) {
        console.error("Get watchlist error:", error);
        res.status(500).json({ message: 'Error fetching watchlist' });
    }
});


// --- Оновлення елемента списку ---
// @desc    Update a watchlist item
// @route   PUT /api/watchlist/:id
// @access  Private
// ЗМІНЕНО: Вилучено 'export' звідси, оскільки воно вже експортується в кінці файлу
const updateWatchlistItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid watchlist item ID' });
    }

    // Забороняємо оновлювати деякі поля напряму
    delete updateData.user;
    delete updateData.externalId;
    delete updateData.mediaType;
    delete updateData.title;
    delete updateData.posterPath;
    delete updateData.originalTitle;
    delete updateData.releaseDate;
    delete updateData.overview;
    delete updateData.genres;
    delete updateData.language;
    delete updateData.runtime;
    delete updateData.totalEpisodes;
    delete updateData.totalSeasons;
    delete updateData.dateAdded;


    // Валідація значень (приклад)
    if (updateData.userRating !== undefined && (updateData.userRating < 0 || updateData.userRating > 10)) {
        return res.status(400).json({ message: 'Rating must be between 0 and 10' });
    }
    if (updateData.status && !['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'].includes(updateData.status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }
    if (updateData.episodesWatched !== undefined && updateData.episodesWatched < 0) {
        return res.status(400).json({ message: 'Episodes watched cannot be negative' });
    }
    if (updateData.dateStartedWatching && isNaN(new Date(updateData.dateStartedWatching).getTime())) {
        return res.status(400).json({ message: 'Invalid dateStartedWatching format' });
    }
     if (updateData.dateCompleted && isNaN(new Date(updateData.dateCompleted).getTime())) {
        return res.status(400).json({ message: 'Invalid dateCompleted format' });
    }
     if (updateData.reminderDate && isNaN(new Date(updateData.reminderDate).getTime())) {
        return res.status(400).json({ message: 'Invalid reminderDate format' });
    }


    // Якщо статус змінюється на 'completed', автоматично встановити dateCompleted, якщо він ще не встановлений
    // АБО якщо його явно передано як null/undefined, тоді видалити його
    if (updateData.status === 'completed' && updateData.dateCompleted === undefined) {
        updateData.dateCompleted = new Date();
    } else if (updateData.status !== 'completed' && updateData.dateCompleted !== undefined) {
            // Якщо статус не 'completed', і dateCompleted передано, видаляємо його
            updateData.dateCompleted = null;
    }


    try {
        const updatedItem = await WatchlistItem.findOneAndUpdate(
            { _id: id, user: userId },
            { $set: updateData },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedItem) {
            return res.status(404).json({ message: 'Watchlist item not found or you do not have permission to update it' });
        }

        updatedItem.poster_full_url = getPosterUrl(updatedItem.posterPath);

        res.json(updatedItem);
    } catch (error) {
        console.error("Update watchlist item error:", error);
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Error updating watchlist item' });
    }
});

// --- Видалення елемента списку ---
// @desc    Delete a watchlist item
// @route   DELETE /api/watchlist/:id
// @access  Private
// ЗМІНЕНО: Вилучено 'export' звідси, оскільки воно вже експортується в кінці файлу
const deleteWatchlistItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid watchlist item ID' });
    }

    try {
        const result = await WatchlistItem.deleteOne({ _id: id, user: userId });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Watchlist item not found or you do not have permission to delete it' });
        }

        res.json({ message: 'Watchlist item deleted successfully' });
    } catch (error) {
        console.error("Delete watchlist item error:", error);
        res.status(500).json({ message: 'Error deleting watchlist item' });
    }
});

// --- (Опціонально) Отримання одного елемента ---
// @desc    Get a single watchlist item details
// @route   GET /api/watchlist/:id
// @access  Private
const getWatchlistItemDetails = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid watchlist item ID' });
    }

    try {
        const item = await WatchlistItem.findOne({ _id: id, user: userId }).lean();
        if (!item) {
            return res.status(404).json({ message: 'Watchlist item not found' });
        }
        item.poster_full_url = getPosterUrl(item.posterPath);
        res.json(item);
    } catch (error) {
        console.error("Get watchlist item details error:", error);
        res.status(500).json({ message: 'Error fetching watchlist item details' });
    }
});


// НОВА ФУНКЦІЯ: Додати або видалити контент зі списку перегляду
// @desc    Add or remove content from user's watchlist
// @route   POST /api/watchlist/toggle
// @access  Private
const toggleWatchlistContent = asyncHandler(async (req, res) => {
    console.log('Backend (toggleWatchlistContent): Отримано запит на оновлення списку перегляду.');
    console.log('Backend (toggleWatchlistContent): Повне тіло запиту (req.body):', req.body);

    // ВИПРАВЛЕНО: Використовуйте externalId замість tmdbId
    const { externalId, mediaType } = req.body;
    const userId = req.user._id;

    // ВИПРАВЛЕНО: Оновіть логи, щоб вони показували externalId
    console.log('Backend (toggleWatchlistContent): Видобуто externalId:', externalId);
    console.log('Backend (toggleWatchlistContent): Видобуто mediaType:', mediaType);

    // ВИПРАВЛЕНО: Використовуйте externalId для перевірки
    if (!externalId || !mediaType) {
        return res.status(400).json({ message: 'External ID and media type are required' });
    }
    if (!['movie', 'tv'].includes(mediaType)) {
        return res.status(400).json({ message: 'Invalid media type' });
    }

    try {
        // 1. Перевірити, чи елемент вже є у списку перегляду користувача
        let watchlistItem = await WatchlistItem.findOne({
            user: userId,
            // ВИПРАВЛЕНО: Використовуйте externalId для запиту до бази даних
            externalId: externalId.toString(),
            mediaType: mediaType,
        });

        if (watchlistItem) {
            // Якщо елемент існує, видалити його
            // ВИПРАВЛЕНО: Використовуйте externalId в лозі
            console.log(`Backend (toggleWatchlistContent): Елемент знайдено, видалення для ID: ${externalId}, Тип: ${mediaType}`);
            await watchlistItem.deleteOne();
            res.status(200).json({
                message: 'Контент успішно видалено зі списку перегляду',
                action: 'removed',
                added: false
            });
        } else {
            // Якщо елемента немає, додати його
            // Отримуємо деталі з TMDB
            // ВИПРАВЛЕНО: Використовуйте externalId в лозі
            console.log(`Backend (toggleWatchlistContent): Елемент не знайдено, запит деталей з TMDB для ID: ${externalId}, Тип: ${mediaType}`);
            // ВИПРАВЛЕНО: Передавайте externalId в getMediaDetails
            const details = await getMediaDetails(externalId, mediaType);
            console.log(`Backend (toggleWatchlistContent): Відповідь TMDB details:`, details);

            if (!details) {
                // ВИПРАВЛЕНО: Використовуйте externalId в лозі
                console.error(`Backend (toggleWatchlistContent): Не вдалося отримати деталі з TMDB для ID: ${externalId}, Тип: ${mediaType}`);
                return res.status(404).json({ message: 'Media not found on external service' });
            }

            console.log(`Backend (toggleWatchlistContent): Деталі отримано, створення нового елемента списку перегляду.`);
            const newItem = await WatchlistItem.create({
                user: userId,
                // ВИПРАВЛЕНО: Використовуйте externalId при створенні запису
                externalId: externalId.toString(),
                mediaType,
                title: details.title || details.name,
                originalTitle: details.original_title || details.original_name,
                posterPath: details.poster_path,
                releaseDate: details.release_date || details.first_air_date,
                overview: details.overview,
                genres: details.genres?.map(g => g.name) || [],
                language: details.original_language,
                runtime: mediaType === 'movie' ? details.runtime : null,
                totalEpisodes: mediaType === 'tv' ? details.number_of_episodes : null,
                totalSeasons: mediaType === 'tv' ? details.number_of_seasons : null,
                status: 'plan_to_watch', // Можете зробити це поле динамічним, якщо потрібно
            });

            const itemWithPoster = newItem.toObject();
            itemWithPoster.poster_full_url = getPosterUrl(itemWithPoster.posterPath);

            res.status(201).json({
                message: 'Контент успішно додано до списку перегляду',
                item: itemWithPoster,
                action: 'added',
                added: true
            });
        }
    } catch (error) {
        console.error("Toggle watchlist content error:", error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'An item with this ID already exists in your watchlist.' });
        }
        // ВИПРАВЛЕНО: Передача error.message
        res.status(500).json({ message: 'Error toggling watchlist content', error: error.message });
    }
});

// Експортуємо функції контролера
export {
    getWatchlist, // Тепер це єдине місце, де getWatchlist експортується
    updateWatchlistItem,
    deleteWatchlistItem,
    getWatchlistItemDetails,
    toggleWatchlistContent,
};