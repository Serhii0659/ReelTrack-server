// server/controllers/userController.js
import User from '../models/User.js';
import WatchlistItem from '../models/WatchlistItem.js';
import Review from '../models/reviewModel.js'; // <--- Переконайтеся, що модель Review імпортована
import mongoose from 'mongoose';
import { getPosterUrl } from '../utils/tmdbHelper.js';
import asyncHandler from 'express-async-handler';
import path from 'path';
import fs from 'fs/promises'; // For avatar deletion
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
            if (user.avatarUrl && !user.avatarUrl.includes('/uploads/default_avatar.png')) {
                const oldAvatarFileName = user.avatarUrl.split('/uploads/')[1];
                const oldAvatarPath = path.join(__dirname, '..', 'uploads', oldAvatarFileName);
                try {
                    await fs.unlink(oldAvatarPath);
                    console.log(`Old avatar deleted: ${oldAvatarPath}`);
                } catch (err) {
                    console.error(`Error deleting old avatar ${oldAvatarPath}:`, err.message);
                }
            }
            avatarUrl = `/uploads/${avatarFile.filename}`;
            user.avatarUrl = avatarUrl;
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

        res.json(updatedUser);

    } catch (error) {
        console.error("Update profile error:", error);
        if (error.name === 'ValidationError') {
            res.status(400);
            throw new Error(error.message);
        }
        if (error.message) {
            throw error;
        }
        res.status(500);
        throw new Error('Error updating profile');
    }
});

// Отримати публічний профіль іншого користувача
// @desc    Get public profile of another user
// @route   GET /api/users/:userId/profile
// @access  Public (with privacy checks)
export const getUserPublicProfile = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user?._id; // req.user is available if authenticated

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
        // Check if current user is in the target user's friends list
        if (user.friends.some(friendId => friendId.equals(currentUserId))) {
            canView = true;
        }
    }
    // The user can always view their own profile
    if (currentUserId && currentUserId.equals(user._id)) {
        canView = true;
    }


    if (!canView) {
        // If access is denied, return limited information
        return res.json({
            _id: user._id,
            name: user.name,
            avatarUrl: user.avatarUrl,
            isPrivate: true, // Indicate that the profile is private
            watchlistPrivacy: user.watchlistPrivacy
        });
    }

    // If access is allowed, return full public profile data
    res.json({
        _id: user._id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        watchlistPrivacy: user.watchlistPrivacy
        // Add any other public fields here
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

    // Check if already friends
    if (recipient.friends.includes(senderId)) {
        res.status(400);
        throw new Error('Already friends');
    }
    // Check if request already sent by current user
    if (recipient.friendRequestsReceived.includes(senderId)) {
        res.status(400);
        throw new Error('Friend request already sent');
    }
    // Check if recipient already sent a request to current user
    if (recipient.friendRequestsSent.includes(senderId)) {
        res.status(400);
        throw new Error('This user already sent you a request. Accept it instead.');
    }

    // Add sender to recipient's received requests
    recipient.friendRequestsReceived.push(senderId);
    // Add recipient to sender's sent requests
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
    const senderId = req.params.userId; // The ID of the user who sent the request
    const recipientId = req.user._id; // The ID of the current user (recipient)

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

    // Check if the friend request exists
    if (!recipient.friendRequestsReceived.includes(senderId)) {
        res.status(404);
        throw new Error('Friend request not found');
    }

    // Add each other to friends lists
    recipient.friends.push(senderId);
    sender.friends.push(recipientId);

    // Remove the request from both users' lists
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
    const targetUserId = req.params.userId; // The ID of the user to reject/remove
    const currentUserId = req.user._id; // The ID of the current user

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

    // Check if it's a received request to reject
    if (currentUser.friendRequestsReceived.includes(targetUserId)) {
        currentUser.friendRequestsReceived = currentUser.friendRequestsReceived.filter(id => !id.equals(targetUserId));
        targetUser.friendRequestsSent = targetUser.friendRequestsSent.filter(id => !id.equals(currentUserId));
        actionTaken = 'rejected';
    }
    // Check if it's a sent request to cancel
    else if (currentUser.friendRequestsSent.includes(targetUserId)) {
        currentUser.friendRequestsSent = currentUser.friendRequestsSent.filter(id => !id.equals(targetUserId));
        targetUser.friendRequestsReceived = targetUser.friendRequestsReceived.filter(id => !id.equals(currentUserId));
        actionTaken = 'cancelled';
    }
    // Check if they are friends to remove
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
        .populate('friends', 'name avatarUrl'); // Load name and avatarUrl of friends

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
        .populate('friendRequestsReceived', 'name avatarUrl'); // Load data of users who sent requests

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

    const friend = await User.findById(friendId).select('friends watchlistPrivacy name'); // Get name for response
    if (!friend) {
        res.status(404);
        throw new Error('User not found');
    }

    let canViewWatchlist = false;
    // Public watchlist
    if (friend.watchlistPrivacy === 'public') {
        canViewWatchlist = true;
    }
    // Friends-only watchlist, check if current user is a friend
    else if (friend.watchlistPrivacy === 'friendsOnly' && currentUserId) {
        if (friend.friends.some(id => id.equals(currentUserId))) {
            canViewWatchlist = true;
        }
    }
    // User can always view their own watchlist (handled by fetchUserWatchlist route)
    // but this check ensures consistency if this controller was used for self-view
    else if (currentUserId.equals(friend._id)) {
         canViewWatchlist = true;
    }


    if (!canViewWatchlist) {
        res.status(403); // Forbidden
        throw new Error('Access denied. This user\'s watchlist is private or for friends only.');
    }

    // If access is allowed, fetch the watchlist items
    const { status, sortBy, sortOrder = 'desc', page = 1, limit = 20 } = req.query;
    const query = { user: friendId }; // Filter by the friend's user ID
    if (status) query.status = status;

    const sortOptions = {};
    if (sortBy) {
        const allowedSortFields = ['createdAt', 'updatedAt', 'dateCompleted', 'userRating', 'releaseDate', 'title'];
        if (allowedSortFields.includes(sortBy)) {
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
        }
    } else {
        sortOptions.updatedAt = -1; // Default sort
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const items = await WatchlistItem.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(); // Use .lean() for faster read if you don't need Mongoose document methods

    // Add full poster URLs
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


// --- Контролер для отримання відгуків та оцінок, залишених поточним користувачем. ---
// @desc    Get current user's reviews and ratings
// @route   GET /api/users/my-reviews
// @access  Private
export const getUserReviews = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Find all reviews left by this user
    const reviews = await Review.find({ reviewer: userId })
        // --- ВИДАЛЕНО: СПРОБУ POPULATE 'content' ---
        // Оскільки в моделі Review немає поля 'content' для populate,
        // ми просто отримуємо відгуки як є. Вони містять tmdbId, mediaType, rating, comment, reviewer.
        // Фронтенд повинен використовувати tmdbId та mediaType для отримання деталей контенту з TMDB.
        // Якщо ви хочете завантажити дані користувача, який залишив відгук (хоча це завжди поточний користувач тут),
        // ви можете використовувати .populate('reviewer', 'name avatarUrl')
        // .populate('reviewer', 'name avatarUrl') // Опціонально: завантажити дані користувача
        .sort({ createdAt: -1 }); // Sort by creation date (newest first)

    // Якщо ви хочете додати повні URL постерів тут, вам потрібно буде отримати posterPath з Review моделі
    // і використовувати getPosterUrl, якщо ви зберігаєте posterPath в моделі Review.
    const reviewsWithPosterUrls = reviews.map(review => {
        const reviewObject = review.toObject(); // Перетворюємо документ Mongoose на простий об'єкт
        // Додаємо повний URL постера, якщо contentPosterPath зберігається в моделі Review
        // та функція getPosterUrl доступна
        if (reviewObject.contentPosterPath) {
             reviewObject.poster_full_url = getPosterUrl(reviewObject.contentPosterPath);
        }
        return reviewObject;
    });


    res.json(reviewsWithPosterUrls);
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


// --- ДОДАНО: Контролер для пошуку користувачів ---
// @desc    Search users by ID (or potentially other fields later)
// @route   GET /api/users/search
// @access  Private (requires authentication)
export const searchUsers = asyncHandler(async (req, res) => {
    const query = req.query.q; // Отримуємо рядок пошуку з параметра запиту 'q'

    if (!query) {
        res.status(400).json({ message: 'Search query is required.' });
        return;
    }

    // Припускаємо, що пошук здійснюється за ID користувача
    // Перевіряємо, чи рядок запиту є валідним ObjectId
    if (!mongoose.Types.ObjectId.isValid(query)) {
        // Якщо формат невірний, повертаємо порожній масив або повідомлення
        // Можливо, варто повернути 400, якщо очікується саме ID
         res.status(400).json({ message: 'Invalid user ID format.' });
         return;
        // АБО: res.json([]); // Повертаємо порожній масив, якщо не валідний ID
    }

    try {
        // Шукаємо користувача за ID
        const user = await User.findById(query).select('name avatarUrl'); // Вибираємо лише необхідні поля

        if (user) {
            // Якщо користувач знайдений, повертаємо його в масиві (для сумісності з очікуваним форматом searchUsers на фронтенді)
            res.json([user]);
        } else {
            // Якщо користувач не знайдений, повертаємо порожній масив
            res.json([]);
        }
    } catch (error) {
        console.error('Помилка при пошуку користувача за ID:', error);
        res.status(500).json({ message: 'Server error during user search.' });
    }
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
