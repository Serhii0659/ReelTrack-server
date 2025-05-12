// server/controllers/userController.js
import User from '../models/User.js';
import WatchlistItem from '../models/WatchlistItem.js';
import Review from '../models/reviewModel.js';
import mongoose from 'mongoose';
import { getMediaDetails, getPosterUrl } from '../utils/tmdbHelper.js'; // Імпортуємо getMediaDetails
import asyncHandler from 'express-async-handler';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Профіль Користувача ---

// Отримати профіль поточного користувача
// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            avatarUrl: user.avatarUrl,
            watchlistPrivacy: user.watchlistPrivacy,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// Оновити профіль поточного користувача
// @desc    Update current user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    // Деструктуруємо 'email' з req.body, якщо ви хочете, щоб він оновлювався
    const { name, email, password, watchlistPrivacy } = req.body; // <--- ЗМІНЕНО: Додано 'email'
    const avatarFile = req.file; // multer поміщає інформацію про файл сюди
    let avatarUrl = null;

    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404);
            throw new Error('User not found');
        }

        // Обробка завантаження файлу аватара та видалення старого аватара
        if (avatarFile) {
            // Шлях до нового аватара має відповідати шляху, куди multer його зберіг
            // (наприклад, /uploads/avatars/filename.png)
            avatarUrl = `/uploads/avatars/${avatarFile.filename}`; // <--- ЗМІНЕНО: Коректний шлях

            // Якщо у користувача був старий аватар (і це не стандартний аватар)
            if (user.avatarUrl && !user.avatarUrl.includes('/uploads/default_avatar.png')) {
                // Витягуємо ім'я файлу зі старого URL аватара
                // Розділяємо по '/uploads/avatars/', щоб отримати лише ім'я файлу
                const oldAvatarFileName = user.avatarUrl.split('/uploads/avatars/')[1]; // <--- ЗМІНЕНО: Коректний split
                if (oldAvatarFileName) { // Перевіряємо, чи ім'я файлу успішно витягнуто
                    const oldAvatarPath = path.join(__dirname, '..', 'uploads', 'avatars', oldAvatarFileName); // <--- ЗМІНЕНО: Коректний шлях
                    try {
                        await fs.unlink(oldAvatarPath); // <--- ЗМІНЕНО: Використовуємо асинхронний fs.unlink
                        console.log(`Old avatar deleted: ${oldAvatarPath}`);
                    } catch (err) {
                        // Логуємо помилку, але не зупиняємо виконання, якщо видалення старого аватара не вдалося
                        console.error(`Error deleting old avatar ${oldAvatarPath}:`, err.message);
                    }
                }
            }
            user.avatarUrl = avatarUrl; // Оновлюємо URL аватара користувача
        }

        if (name !== undefined) user.name = name;
        if (email !== undefined) user.email = email; // <--- ДОДАНО: Оновлюємо email, якщо надано

        if (watchlistPrivacy && ['public', 'friendsOnly', 'private'].includes(watchlistPrivacy)) {
            user.watchlistPrivacy = watchlistPrivacy;
        }

        if (password && password.length > 0) {
            if (password.length < 6) {
                res.status(400);
                throw new Error('Password must be at least 6 characters long');
            }
            user.password = password; // Хешування пароля відбувається в pre-save хуку в моделі User
        }

        const updatedUser = await user.save();

        // Рекомендується повертати "очищений" об'єкт користувача без чутливої інформації,
        // такої як хешований пароль. Це припускає, що ваша модель User має метод toJSON
        // або віртуальну властивість, яка обробляє це.
        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            avatarUrl: updatedUser.avatarUrl,
            watchlistPrivacy: updatedUser.watchlistPrivacy,
            // Додайте інші поля, які ви хочете повернути
        });

    } catch (error) {
        console.error("Update profile error:", error);
        if (error.name === 'ValidationError') {
            res.status(400);
            throw new Error(error.message);
        }
        // Якщо статус відповіді ще не встановлено, встановлюємо 500.
        // Якщо статус вже встановлено (наприклад, 400 від попередньої перевірки), залишаємо його.
        res.status(res.statusCode === 200 ? 500 : res.statusCode);
        throw error; // Перекидаємо помилку далі до загального обробника помилок Express
    }
});

// Отримати публічний профіль іншого користувача
// @desc    Get public profile of another user
// @route   GET /api/users/:userId/profile
// @access  Public (with privacy checks)
export const getUserPublicProfile = asyncHandler(async (req, res) => {
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
    }
    if (currentUserId && currentUserId.equals(user._id)) {
        canView = true;
    }


    if (!canView) {
        return res.json({
            _id: user._id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            isPrivate: true,
            watchlistPrivacy: user.watchlistPrivacy
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
// @desc    Send a friend request
// @route   POST /api/users/friends/request/:userId
// @access  Private
export const sendFriendRequest = asyncHandler(async (req, res) => {
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
// @desc    Accept a friend request
// @route   POST /api/users/friends/accept/:userId
// @access  Private
export const acceptFriendRequest = asyncHandler(async (req, res) => {
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
// @desc    Reject a friend request or remove a friend
// @route   DELETE /api/users/friends/remove/:userId
// @access  Private
export const rejectOrRemoveFriend = asyncHandler(async (req, res) => {
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
    }
    else if (currentUser.friendRequestsSent.includes(targetUserId)) {
        currentUser.friendRequestsSent = currentUser.friendRequestsSent.filter(id => !id.equals(targetUserId));
        targetUser.friendRequestsReceived = targetUser.friendRequestsReceived.filter(id => !id.equals(currentUserId));
        actionTaken = 'cancelled';
    }
    else if (currentUser.friends.includes(targetUserId)) {
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
// @desc    Get current user's friends list
// @route   GET /api/users/friends
// @access  Private
export const getFriends = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
        .populate('friends', 'name avatarUrl');

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    res.json(user.friends);
});

// Отримати список отриманих запитів у друзі
// @desc    Get current user's received friend requests
// @route   GET /api/users/friends/requests
// @access  Private
export const getFriendRequests = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
        .populate('friendRequestsReceived', 'name avatarUrl');

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    res.json(user.friendRequestsReceived);
});

// Отримати список перегляду ДРУГА (з перевіркою приватності)
// @desc    Get a friend's watchlist (with privacy check)
// @route   GET /api/users/:userId/watchlist
// @access  Private (requires authentication to check friendship/privacy)
export const getFriendWatchlist = asyncHandler(async (req, res) => {
    const friendId = req.params.userId;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
        res.status(400);
        throw new Error('Invalid friend ID');
    }

    const friend = await User.findById(friendId).select('friends watchlistPrivacy name');
    if (!friend) {
        res.status(404);
        throw new Error('User not found');
    }

    let canViewWatchlist = false;
    if (friend.watchlistPrivacy === 'public') {
        canViewWatchlist = true;
    }
    else if (friend.watchlistPrivacy === 'friendsOnly' && currentUserId) {
        if (friend.friends.some(id => id.equals(currentUserId))) {
            canViewWatchlist = true;
        }
    }
    else if (currentUserId.equals(friend._id)) {
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
        .lean();

    const itemsWithPoster = items.map(item => ({
        ...item,
        poster_full_url: getPosterUrl(item.posterPath)
    }));

    const totalItems = await WatchlistItem.countDocuments(query);

    res.json({
        friendName: friend.name,
        items: itemsWithPoster,
        currentPage: pageNum,
        totalPages: Math.ceil(totalItems / limitNum),
        totalItems
    });
});


// --- Статистика та Аналіз ---

// Генерація статистики для поточного користувача
// @desc    Get current user's statistics
// @route   GET /api/users/stats
// @access  Private
export const getUserStats = asyncHandler(async (req, res) => {
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
        planToWatchCount: allItems.filter(item => item.status === 'plan_to_watch').length,
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


// --- Контролер для отримання відгуків та оцінок, залишених поточним користувачем. ---
// @desc    Get current user's reviews and ratings
// @route   GET /api/users/my-reviews
// @access  Private
export const getUserReviews = asyncHandler(async (req, res) => {
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

// НОВА ФУНКЦІЯ: Видалити відгук користувача
// @desc    Delete a user's review
// @route   DELETE /api/users/my-reviews/:reviewId
// @access  Private
export const deleteReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const userId = req.user._id; // Current authenticated user

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        res.status(400);
        throw new Error('Невірний формат ID відгуку.');
    }

    const review = await Review.findById(reviewId);

    if (!review) {
        res.status(404);
        throw new Error('Відгук не знайдено.');
    }

    // Ensure the review belongs to the authenticated user
    if (review.reviewer.toString() !== userId.toString()) {
        res.status(403); // Forbidden
        throw new Error('Користувач не має прав для видалення цього відгуку.');
    }

    await Review.deleteOne({ _id: reviewId });

    res.status(200).json({ message: 'Відгук успішно видалено!' });
});


// @desc    Add content to user's library (using WatchlistItem model)
// @route   POST /api/users/library/add
// @access  Private
// Ця функція, ймовірно, дублює логіку toggleWatchlistContent і може бути видалена.
// ЗМІНЕНО: РОЗКОМЕНТОВАНО функцію addContentToLibrary
export const addContentToLibrary = asyncHandler(async (req, res) => {
    console.log('User in addContentToLibrary controller:', req.user);
    const { tmdbId, mediaType, status, title, posterPath, releaseDate, genres } = req.body;

    if (!tmdbId || !mediaType || !title || !posterPath) {
        res.status(400);
        throw new Error('TMDB ID, media type, title, and poster path are required.');
    }

    const userId = req.user._id;

    const existingItem = await WatchlistItem.findOne({
        user: userId,
        externalId: String(tmdbId),
        mediaType: mediaType,
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


// --- ДОДАНО: Контролер для пошуку користувачів ---
// @desc    Search users by ID (or potentially other fields later)
// @route   GET /api/users/search
// @access  Private (requires authentication)
export const searchUsers = asyncHandler(async (req, res) => {
    const query = req.query.q;

    if (!query) {
        res.status(400).json({ message: 'Search query is required.' });
        return;
    }

    if (!mongoose.Types.ObjectId.isValid(query)) {
           res.status(400).json({ message: 'Invalid user ID format.' });
           return;
    }

    try {
        const user = await User.findById(query).select('name avatarUrl');

        if (user) {
            res.json([user]);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Помилка при пошуку користувача за ID:', error);
        res.status(500).json({ message: 'Server error during user search.' });
    }
});

// НОВА ФУНКЦІЯ: Отримати статус елемента в списку перегляду користувача
// @desc    Get watchlist status for a specific content item for the current user
// @route   GET /api/users/watchlist/status/:mediaType/:tmdbId
// @access  Private
export const getUserWatchlistStatus = asyncHandler(async (req, res) => {
    const { mediaType, tmdbId } = req.params;
    const userId = req.user._id; // User ID from authentication middleware

    if (!userId) {
        res.status(401);
        throw new Error('Не авторизовано, немає токена користувача.');
    }

    if (!mediaType || !tmdbId) {
        res.status(400);
        throw new Error('Тип медіа та TMDB ID є обов\'язковими.');
    }

    // Перевірку ObjectId для tmdbId ВИДАЛЕНО, оскільки це ID з TMDB, а не з MongoDB
    // if (!mongoose.Types.ObjectId.isValid(tmdbId)) {
    //     res.status(400);
    //     throw new Error('Невірний формат ID відгуку.');
    // }

    const watchlistItem = await WatchlistItem.findOne({
        user: userId,
        externalId: String(tmdbId), // Переконайтеся, що externalId зберігається як рядок, якщо це ваша схема
        mediaType: mediaType,
    });

    if (watchlistItem) {
        res.json({ exists: true, status: watchlistItem.status, userRating: watchlistItem.userRating });
    } else {
        res.json({ exists: false, status: null, userRating: null });
    }
});


// --- Генерація Картинок (складно, вимагає додаткових бібліотек) ---
/*
export const generateShareImage = asyncHandler(async (req, res) => {
    res.status(501).json({ message: 'Image generation not implemented yet' });
});

export const generateRecommendationCard = asyncHandler(async (req, res) => {
     res.status(501).json({ message: 'Recommendation card generation not implemented yet' });
});
*/