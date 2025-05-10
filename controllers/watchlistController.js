import WatchlistItem from '../models/WatchlistItem.js';
import User from '../models/User.js'; // Може знадобитися для перевірки приватності
import { getMediaDetails, getPosterUrl } from '../utils/tmdbHelper.js'; // Потрібен для отримання деталей перед додаванням
import mongoose from 'mongoose';

// --- Додавання елемента до списку ---
export const addToWatchlist = async (req, res) => {
    const { externalId, mediaType, status } = req.body; // Отримуємо ID і тип з запиту
    const userId = req.user._id; // ID користувача з authMiddleware

    if (!externalId || !mediaType) {
        return res.status(400).json({ message: 'External ID and media type are required' });
    }
    if (!['movie', 'tv'].includes(mediaType)) {
        return res.status(400).json({ message: 'Invalid media type' });
    }

    try {
        const existingItem = await WatchlistItem.findOne({ user: userId, externalId: externalId.toString(), mediaType });
        if (existingItem) {
            return res.status(400).json({ message: 'Item already exists in your watchlist' });
        }

        // Отримуємо деталі з TMDB, щоб зберегти основну інформацію
        const details = await getMediaDetails(externalId, mediaType);
        if (!details) {
            return res.status(404).json({ message: 'Media not found on external service' });
        }

        const newItem = new WatchlistItem({
            user: userId,
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
            status: status || 'plan_to_watch',
        });

        await newItem.save();

// Повертаємо створений елемент (з повним URL постера)
        const itemWithPoster = newItem.toObject();
        itemWithPoster.poster_full_url = getPosterUrl(itemWithPoster.posterPath);

        res.status(201).json(itemWithPoster);

    } catch (error) {
        console.error("Add to watchlist error:", error);
        if (error.code === 11000) { // Duplicate key error
            return res.status(400).json({ message: 'Item already seems to exist in your watchlist.' });
        }
        res.status(500).json({ message: 'Error adding item to watchlist', error: error.message });
    }
};

// --- Отримання списку перегляду користувача ---
export const getWatchlist = async (req, res) => {
    const userId = req.user._id;
    const { status, sortBy, sortOrder = 'desc', page = 1, limit = 20 } = req.query;

    const query = { user: userId };
    if (status) {
        query.status = status; // Фільтрація за статусом
    }

    const sortOptions = {};
    if (sortBy) {
        // Дозволені поля для сортування
        const allowedSortFields = ['createdAt', 'updatedAt', 'dateCompleted', 'userRating', 'releaseDate', 'title'];
        if (allowedSortFields.includes(sortBy)) {
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
        } else {
            return res.status(400).json({ message: `Sorting by '${sortBy}' is not allowed.` });
        }
    } else {
        sortOptions.updatedAt = -1; // Сортування за замовчуванням (останні оновлені)
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    try {
        const items = await WatchlistItem.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum)
            .lean(); // .lean() для швидшості, повертає прості JS об'єкти

        // Додаємо URL постера
        const itemsWithPoster = items.map(item => ({
            ...item,
            poster_full_url: getPosterUrl(item.posterPath)
        }));

        // Отримуємо загальну кількість елементів для пагінації
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
};


// --- Оновлення елемента списку ---
export const updateWatchlistItem = async (req, res) => {
    const { id } = req.params; // ID запису в *нашій* базі даних
    const userId = req.user._id;
    const updateData = req.body; // Дані для оновлення (status, userRating, episodesWatched, userNotes, dateStartedWatching, dateCompleted, reminderDate)

    // Перевірка валідності ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid watchlist item ID' });
    }

    // Забороняємо оновлювати деякі поля напряму
    delete updateData.user;
    delete updateData.externalId;
    delete updateData.mediaType;
    delete updateData.title; // та інші поля, що беруться з TMDB

    // Валідація значень (приклад)
    if (updateData.userRating && (updateData.userRating < 0 || updateData.userRating > 10)) {
        return res.status(400).json({ message: 'Rating must be between 0 and 10' });
    }
    if (updateData.status && !['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'].includes(updateData.status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }
    if (updateData.episodesWatched && updateData.episodesWatched < 0) {
        return res.status(400).json({ message: 'Episodes watched cannot be negative' });
    }

    // Якщо статус змінюється на 'completed', автоматично встановити dateCompleted
    if (updateData.status === 'completed' && !updateData.dateCompleted) {
        updateData.dateCompleted = new Date();
    }
    // Якщо статус змінюється на 'watching', автоматично встановити dateStartedWatching (якщо ще не встановлено)
    // (Потребує перевірки поточного стану об'єкта) - Краще робити на клієнті або з обережністю тут


    try {
        const updatedItem = await WatchlistItem.findOneAndUpdate(
            { _id: id, user: userId }, // Знайти елемент за ID І переконатись, що він належить користувачу
            { $set: updateData }, // Застосувати оновлення
            { new: true, runValidators: true } // Повернути оновлений документ і запустити валідатори моделі
        ).lean();

        if (!updatedItem) {
            return res.status(404).json({ message: 'Watchlist item not found or you do not have permission to update it' });
        }

        // Додаємо URL постера
        updatedItem.poster_full_url = getPosterUrl(updatedItem.posterPath);

        res.json(updatedItem);
    } catch (error) {
        console.error("Update watchlist item error:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error updating watchlist item' });
    }
};

// --- Видалення елемента списку ---
export const deleteWatchlistItem = async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid watchlist item ID' });
    }

    try {
        const result = await WatchlistItem.deleteOne({ _id: id, user: userId }); // Перевіряємо належність користувачу

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Watchlist item not found or you do not have permission to delete it' });
        }

        res.json({ message: 'Watchlist item deleted successfully' });
    } catch (error) {
        console.error("Delete watchlist item error:", error);
        res.status(500).json({ message: 'Error deleting watchlist item' });
    }
};

// --- (Опціонально) Отримання одного елемента ---
export const getWatchlistItemDetails = async (req, res) => {
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
};