// server/controllers/userController.js
import User from '../models/User.js';
import WatchlistItem from '../models/WatchlistItem.js';
import mongoose from 'mongoose';
import { getPosterUrl } from '../utils/tmdbHelper.js';
import asyncHandler from 'express-async-handler'; // <<< Add this import
import path from 'path';
import fs from 'fs/promises'; // For avatar deletion
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Профіль Користувача ---

// Отримати профіль поточного користувача
export const getUserProfile = asyncHandler(async (req, res) => { // Using asyncHandler
    // req.user вже містить дані користувача з authMiddleware (без пароля)
    // Завантажуємо user з бази даних, щоб отримати avatarUrl та інші деталі, яких може не бути в req.user з токена
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            avatarUrl: user.avatarUrl, // Avatar URL from DB
            watchlistPrivacy: user.watchlistPrivacy,
            // You might populate friends/friendRequests here if needed for initial profile load
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});


// Оновити профіль поточного користувача
export const updateUserProfile = asyncHandler(async (req, res) => { // Using asyncHandler
    const userId = req.user._id;
    const { name, password, watchlistPrivacy } = req.body;
    const avatarFile = req.file;
    let avatarUrl = null;

    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        // Handle avatar file upload and old avatar deletion
        if (avatarFile) {
            // Construct the absolute path for the old avatar to delete
            if (user.avatarUrl && !user.avatarUrl.includes('/uploads/default_avatar.png')) {
                const oldAvatarFileName = user.avatarUrl.split('/uploads/')[1];
                const oldAvatarPath = path.join(__dirname, '..', 'uploads', oldAvatarFileName);
                try {
                    await fs.unlink(oldAvatarPath);
                    console.log(`Old avatar deleted: ${oldAvatarPath}`);
                } catch (err) {
                    console.error(`Error deleting old avatar ${oldAvatarPath}:`, err.message);
                    // Don't block the request if deletion fails, just log it
                }
            }
            avatarUrl = `/uploads/${avatarFile.filename}`;
            user.avatarUrl = avatarUrl; // Update user's avatar URL in DB
        }

        if (name !== undefined) user.name = name;

        if (watchlistPrivacy && ['public', 'friendsOnly', 'private'].includes(watchlistPrivacy)) {
            user.watchlistPrivacy = watchlistPrivacy;
        }

        if (password && password.length > 0) {
            if (password.length < 6) {
                res.status(400);
                throw new Error('Password must be at least 6 characters long');
            }
            user.password = password; // Hashing happens in pre-save hook
        }

        const updatedUser = await user.save();

        // Return updated user data (excluding password, which is handled by toJSON)
        res.json(updatedUser);

    } catch (error) {
        console.error("Update profile error:", error);
        // If you are using Multer, make sure to import it to check its errors
        // For example: import multer from 'multer'; at the top
        // if (error instanceof multer.MulterError) {
        //     res.status(400);
        //     throw new Error(`Multer error: ${error.message}`);
        // }
        if (error.name === 'ValidationError') {
            res.status(400);
            throw new Error(error.message);
        }
        // If it's already an Error (from throw new Error), re-throw it
        if (error.message) {
            throw error;
        }
        // Generic server error
        res.status(500);
        throw new Error('Error updating profile');
    }
});

// Отримати публічний профіль іншого користувача
export const getUserPublicProfile = asyncHandler(async (req, res) => { // Using asyncHandler
    const { userId } = req.params;
    const currentUserId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        res.status(400);
        throw new Error('Invalid user ID');
    }

    const user = await User.findById(userId).select('name watchlistPrivacy friends avatarUrl');
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    let canView = false;
    if (user.watchlistPrivacy === 'public') {
        canView = true;
    } else if (user.watchlistPrivacy === 'friendsOnly' && currentUserId) {
        if (user.friends.some(friendId => friendId.equals(currentUserId))) {
            canView = true;
        }
    } else if (currentUserId && currentUserId.equals(user._id)) {
        canView = true;
    }

    if (!canView) {
        // Return only basic public info if not authorized to see more
        return res.json({
            _id: user._id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            isPrivate: true,
            watchlistPrivacy: user.watchlistPrivacy // Indicate the privacy setting
        });
    }

    res.json({
        _id: user._id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        watchlistPrivacy: user.watchlistPrivacy
    });
});

// --- Управління Друзями ---

// Надіслати запит у друзі
export const sendFriendRequest = asyncHandler(async (req, res) => { // Using asyncHandler
    const recipientId = req.params.userId;
    const senderId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        res.status(400);
        throw new Error('Invalid recipient ID');
    }
    if (senderId.equals(recipientId)) {
        res.status(400);
        throw new Error("You cannot send a friend request to yourself");
    }

    const recipient = await User.findById(recipientId);
    const sender = await User.findById(senderId);

    if (!recipient || !sender) {
        res.status(404);
        throw new Error('User not found');
    }

    if (recipient.friends.includes(senderId)) {
        res.status(400);
        throw new Error('Already friends');
    }
    if (recipient.friendRequestsReceived.includes(senderId)) {
        res.status(400);
        throw new Error('Friend request already sent');
    }
    if (recipient.friendRequestsSent.includes(senderId)) {
        res.status(400);
        throw new Error('This user already sent you a request. Accept it instead.');
    }

    recipient.friendRequestsReceived.push(senderId);
    sender.friendRequestsSent.push(recipientId);

    await recipient.save();
    await sender.save();

    res.status(200).json({ message: 'Friend request sent successfully' });
});

// Прийняти запит у друзі
export const acceptFriendRequest = asyncHandler(async (req, res) => { // Using asyncHandler
    const senderId = req.params.userId;
    const recipientId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
        res.status(400);
        throw new Error('Invalid sender ID');
    }

    const recipient = await User.findById(recipientId);
    const sender = await User.findById(senderId);

    if (!recipient || !sender) {
        res.status(404);
        throw new Error('User not found');
    }

    if (!recipient.friendRequestsReceived.includes(senderId)) {
        res.status(404);
        throw new Error('Friend request not found');
    }

    recipient.friends.push(senderId);
    sender.friends.push(recipientId);

    recipient.friendRequestsReceived = recipient.friendRequestsReceived.filter(id => !id.equals(senderId));
    sender.friendRequestsSent = sender.friendRequestsSent.filter(id => !id.equals(recipientId));

    await recipient.save();
    await sender.save();

    res.status(200).json({ message: 'Friend request accepted' });
});

// Відхилити запит АБО видалити друга
export const rejectOrRemoveFriend = asyncHandler(async (req, res) => { // Using asyncHandler
    const targetUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
        res.status(400);
        throw new Error('Invalid user ID');
    }
    if (currentUserId.equals(targetUserId)) {
        res.status(400);
        throw new Error("Action cannot be performed on yourself");
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!currentUser || !targetUser) {
        res.status(404);
        throw new Error('User not found');
    }

    let actionTaken = null;

    if (currentUser.friendRequestsReceived.includes(targetUserId)) {
        currentUser.friendRequestsReceived = currentUser.friendRequestsReceived.filter(id => !id.equals(targetUserId));
        targetUser.friendRequestsSent = targetUser.friendRequestsSent.filter(id => !id.equals(currentUserId));
        actionTaken = 'rejected';
    } else if (currentUser.friendRequestsSent.includes(targetUserId)) {
        currentUser.friendRequestsSent = currentUser.friendRequestsSent.filter(id => !id.equals(targetUserId));
        targetUser.friendRequestsReceived = targetUser.friendRequestsReceived.filter(id => !id.equals(currentUserId));
        actionTaken = 'cancelled';
    } else if (currentUser.friends.includes(targetUserId)) {
        currentUser.friends = currentUser.friends.filter(id => !id.equals(targetUserId));
        targetUser.friends = targetUser.friends.filter(id => !id.equals(currentUserId));
        actionTaken = 'removed';
    } else {
        res.status(404);
        throw new Error('No pending request or existing friendship found with this user');
    }

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({ message: `Friendship ${actionTaken} successfully` });
});

// Отримати список друзів поточного користувача
export const getFriends = asyncHandler(async (req, res) => { // Using asyncHandler
    const user = await User.findById(req.user._id)
        .populate('friends', 'name avatarUrl'); // Load name and avatarUrl of friends

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    res.json(user.friends);
});

// Отримати список отриманих запитів у друзі
export const getFriendRequests = asyncHandler(async (req, res) => { // Using asyncHandler
    const user = await User.findById(req.user._id)
        .populate('friendRequestsReceived', 'name avatarUrl'); // Load data of users who sent requests

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    res.json(user.friendRequestsReceived);
});

// Отримати список перегляду ДРУГА (з перевіркою приватності)
export const getFriendWatchlist = asyncHandler(async (req, res) => { // Using asyncHandler
    const friendId = req.params.userId;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
        res.status(400);
        throw new Error('Invalid friend ID');
    }

    const friend = await User.findById(friendId).select('friends watchlistPrivacy name'); // Get name for response
    if (!friend) {
        res.status(404);
        throw new Error('User not found');
    }

    let canViewWatchlist = false;
    if (friend.watchlistPrivacy === 'public') {
        canViewWatchlist = true;
    } else if (friend.watchlistPrivacy === 'friendsOnly' && friend.friends.some(id => id.equals(currentUserId))) {
        canViewWatchlist = true;
    } else if (currentUserId.equals(friend._id)) {
        canViewWatchlist = true;
    }

    if (!canViewWatchlist) {
        res.status(403);
        throw new Error('Access denied. This user\'s watchlist is private or for friends only.');
    }

    const { status, sortBy, sortOrder = 'desc', page = 1, limit = 20 } = req.query;
    const query = { user: friendId };
    if (status) query.status = status;

    const sortOptions = {};
    if (sortBy) {
        const allowedSortFields = ['createdAt', 'updatedAt', 'dateCompleted', 'userRating', 'releaseDate', 'title'];
        if (allowedSortFields.includes(sortBy)) {
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
        }
    } else {
        sortOptions.updatedAt = -1;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const items = await WatchlistItem.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(); // Use .lean() for faster read if you don't need Mongoose document methods

    const itemsWithPoster = items.map(item => ({
        ...item,
        poster_full_url: getPosterUrl(item.posterPath)
    }));

    const totalItems = await WatchlistItem.countDocuments(query);

    res.json({
        friendName: friend.name, // Include friend's name in the response
        items: itemsWithPoster,
        currentPage: pageNum,
        totalPages: Math.ceil(totalItems / limitNum),
        totalItems
    });
});

// --- Статистика та Аналіз ---

// Генерація статистики для поточного користувача
export const getUserStats = asyncHandler(async (req, res) => { // Using asyncHandler
    const userId = req.user._id;

    const allItems = await WatchlistItem.find({ user: userId }).lean();

    if (!allItems.length) {
        return res.json({ message: 'No items in watchlist to generate stats.', stats: {} });
    }

    const stats = {
        totalItems: allItems.length,
        moviesCount: allItems.filter(item => item.mediaType === 'movie').length,
        tvShowsCount: allItems.filter(item => item.mediaType === 'tv').length,
        completedCount: allItems.filter(item => item.status === 'completed').length,
        watchingCount: allItems.filter(item => item.status === 'watching').length,
        planToWatchCount: allItems.filter(item => item.status === 'plan_to_watch').length, // Note: your current code uses 'planning' not 'plan_to_watch'
        onHoldCount: allItems.filter(item => item.status === 'on_hold').length,
        droppedCount: allItems.filter(item => item.status === 'dropped').length,
        averageRating: 0,
        favoriteGenres: [],
        completionActivity: {},
    };

    const ratedItems = allItems.filter(item => item.userRating && item.userRating > 0);
    if (ratedItems.length > 0) {
        const totalRating = ratedItems.reduce((sum, item) => sum + item.userRating, 0);
        stats.averageRating = parseFloat((totalRating / ratedItems.length).toFixed(1));
    }

    const genreCounts = {};
    allItems.forEach(item => {
        item.genres?.forEach(genre => {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });
    });
    stats.favoriteGenres = Object.entries(genreCounts)
        .sort(([, countA], [, countB]) => countB - countA)
        .slice(0, 5)
        .map(([genre, count]) => ({ genre, count }));

    const completedItems = allItems.filter(item => item.status === 'completed' && item.dateCompleted);
    completedItems.forEach(item => {
        const monthYear = item.dateCompleted.toISOString().slice(0, 7);
        stats.completionActivity[monthYear] = (stats.completionActivity[monthYear] || 0) + 1;
    });
    stats.completionActivity = Object.entries(stats.completionActivity)
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});

    res.json({ stats });
});


// @desc    Add content to user's library (using WatchlistItem model)
// @route   POST /api/users/library/add
// @access  Private
export const addContentToLibrary = asyncHandler(async (req, res) => {
    console.log('User in addContentToLibrary controller:', req.user);
    const { tmdbId, mediaType, status, title, posterPath, releaseDate, genres } = req.body;

    if (!tmdbId || !mediaType || !title || !posterPath) {
        res.status(400);
        throw new Error('TMDB ID, media type, title, and poster path are required.');
    }

    const userId = req.user._id; // Переконайтеся, що req.user._id доступний (користувач автентифікований)

    // Check if content already exists in the user's Watchlist
    const existingItem = await WatchlistItem.findOne({
        user: userId,
        externalId: String(tmdbId), // Важливо: порівнюємо з externalId
        mediaType: mediaType,
    });

    if (existingItem) {
        res.status(400);
        throw new Error('Content already exists in your library.');
    }

    // === ДОДАНО: Створення нового WatchlistItem та його збереження ===
    const newItem = new WatchlistItem({
        user: userId,
        externalId: String(tmdbId), // TMDB ID зберігається як externalId (перетворюємо в String, бо у схемі String)
        mediaType,
        title,
        posterPath,
        releaseDate,
        genres,
        status, // Використовуємо статус, що прийшов з фронтенду (тепер це 'plan_to_watch')
        // Додайте інші поля, які ви хочете зберегти, наприклад:
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
// Заглушки для функцій, реалізація потребує 'canvas' або 'puppeteer'
/*
export const generateShareImage = asyncHandler(async (req, res) => {
    // 1. Отримати статистику користувача (викликати getUserStats або подібну логіку)
    // 2. Використовувати бібліотеку типу 'canvas' або 'puppeteer' для рендерингу статистики на фоновому зображенні/шаблоні
    // 3. Встановити правильний Content-Type ('image/png' або 'image/jpeg')
    // 4. Надіслати згенероване зображення у відповідь (res.send(buffer) або res.sendFile(path))
    res.status(501).json({ message: 'Image generation not implemented yet' });
});

export const generateRecommendationCard = asyncHandler(async (req, res) => {
     // 1. Отримати ID елемента зі списку req.params.watchlistItemId
     // 2. Знайти цей елемент в базі даних WatchlistItem.findById(...)
     // 3. Перевірити, чи належить він користувачу req.user._id
     // 4. Отримати дані (постер, назва, опис, оцінка користувача)
     // 5. Використати бібліотеку для генерації зображення картки
     // 6. Надіслати зображення
     res.status(501).json({ message: 'Recommendation card generation not implemented yet' });
});
*/

// --- TODO: Рекомендації (дуже складно, опціонально) ---
// --- TODO: Нагадування (потребує планувальника завдань/cron) ---