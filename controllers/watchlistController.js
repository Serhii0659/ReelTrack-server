import WatchlistItem from '../models/WatchlistItem.js';
import { getMediaDetails, getPosterUrl } from '../utils/tmdbHelper.js'; // Потрібен для отримання деталей перед додаванням
import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';

// --- Отримання списку перегляду користувача ---
// @desc    Get current user's watchlist
// @route   GET /api/watchlist
// @access  Private
const getWatchlist = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { status, sortBy, sortOrder = 'desc', page = 1, limit = 20 } = req.query;

    const query = { user: userId };
    if (status) query.status = status;

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
const updateWatchlistItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid watchlist item ID' });
    }

    // Забороняємо оновлювати деякі поля напряму
    [
        'user', 'externalId', 'mediaType', 'title', 'posterPath', 'originalTitle',
        'releaseDate', 'overview', 'genres', 'language', 'runtime',
        'totalEpisodes', 'totalSeasons', 'dateAdded'
    ].forEach(field => delete updateData[field]);

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

    if (updateData.status === 'completed' && updateData.dateCompleted === undefined) {
        updateData.dateCompleted = new Date();
    } else if (updateData.status !== 'completed' && updateData.dateCompleted !== undefined) {
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

// --- Додати або видалити контент зі списку перегляду ---
// @desc    Add or remove content from user's watchlist
// @route   POST /api/watchlist/toggle
// @access  Private
const toggleWatchlistContent = asyncHandler(async (req, res) => {
    const { externalId, mediaType } = req.body;
    const userId = req.user._id;

    if (!externalId || !mediaType) {
        return res.status(400).json({ message: 'External ID and media type are required' });
    }
    if (!['movie', 'tv'].includes(mediaType)) {
        return res.status(400).json({ message: 'Invalid media type' });
    }

    try {
        let watchlistItem = await WatchlistItem.findOne({
            user: userId,
            externalId: externalId.toString(),
            mediaType: mediaType,
        });

        if (watchlistItem) {
            await watchlistItem.deleteOne();
            res.status(200).json({
                message: 'Контент успішно видалено зі списку перегляду',
                action: 'removed',
                added: false
            });
        } else {
            const details = await getMediaDetails(externalId, mediaType);

            if (!details) {
                return res.status(404).json({ message: 'Media not found on external service' });
            }

            const newItem = await WatchlistItem.create({
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
                status: 'plan_to_watch',
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
        res.status(500).json({ message: 'Error toggling watchlist content', error: error.message });
    }
});

// Експортуємо функції контролера
export {
    getWatchlist,
    updateWatchlistItem,
    deleteWatchlistItem,
    getWatchlistItemDetails,
    toggleWatchlistContent,
};