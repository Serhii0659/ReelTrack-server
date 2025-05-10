import User from '../models/User.js';
import WatchlistItem from '../models/WatchlistItem.js';
import mongoose from 'mongoose';
import { getPosterUrl } from '../utils/tmdbHelper.js'; // Для списку друзів

// --- Профіль Користувача ---

// Отримати профіль поточного користувача
export const getUserProfile = async (req, res) => {
    // req.user вже містить дані користувача з authMiddleware (без пароля)
    res.json(req.user);
};

// Оновити профіль поточного користувача
export const updateUserProfile = async (req, res) => {
    const userId = req.user._id;
    const { name, email, password, watchlistPrivacy /*, avatarUrl */ } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Перевірка унікальності email, якщо він змінюється
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ message: 'Email already in use' });
            }
            user.email = email;
        }

        // Оновлення полів
        if (name) user.name = name;
        if (watchlistPrivacy && ['public', 'friendsOnly', 'private'].includes(watchlistPrivacy)) {
            user.watchlistPrivacy = watchlistPrivacy;
        }
        // if (avatarUrl) user.avatarUrl = avatarUrl;

        // Оновлення пароля (хешування відбудеться в pre-save hook)
        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ message: 'Password must be at least 6 characters long' });
            }
            user.password = password;
        }

        const updatedUser = await user.save();
        res.json(updatedUser); // Поверне дані без пароля завдяки toJSON

    } catch (error) {
        console.error("Update profile error:", error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error updating profile' });
    }
};

// Отримати публічний профіль іншого користувача
export const getUserPublicProfile = async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user?._id; // ID поточного користувача, якщо він залогінений

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
    }

    try {
        // Знаходимо користувача, вибираємо лише потрібні поля
        const user = await User.findById(userId).select('name watchlistPrivacy friends'); // Додаємо friends для перевірки
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Перевірка приватності
        let canView = false;
        if (user.watchlistPrivacy === 'public') {
            canView = true;
        } else if (user.watchlistPrivacy === 'friendsOnly' && currentUserId) {
            // Перевіряємо, чи поточний користувач є другом цільового користувача
            if (user.friends.some(friendId => friendId.equals(currentUserId))) {
                canView = true;
            }
        } else if (currentUserId && currentUserId.equals(user._id)) {
            // Сам користувач може бачити свій профіль
            canView = true;
        }


        if (!canView) {
            // Повертаємо обмежену інформацію або помилку доступу
            // return res.status(403).json({ message: 'Profile is private or friends only' });
            return res.json({ // Повертаємо лише ім'я
                _id: user._id,
                name: user.name,
                isPrivate: true // Додаємо флаг, що профіль приватний
            });
        }

        // Повертаємо публічну інформацію (без email, налаштувань тощо)
        res.json({
            _id: user._id,
            name: user.name,
            // Можна додати інші публічні поля, наприклад, кількість друзів, дату реєстрації
            // friendCount: user.friends.length
        });

    } catch (error) {
        console.error("Get public profile error:", error);
        res.status(500).json({ message: 'Error fetching user profile' });
    }
};


// --- Управління Друзями ---

// Надіслати запит у друзі
export const sendFriendRequest = async (req, res) => {
    const recipientId = req.params.userId;
    const senderId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
        return res.status(400).json({ message: 'Invalid recipient ID' });
    }
    if (senderId.equals(recipientId)) {
        return res.status(400).json({ message: "You cannot send a friend request to yourself" });
    }

    try {
        const recipient = await User.findById(recipientId);
        const sender = await User.findById(senderId); // Потрібен для оновлення його списку

        if (!recipient || !sender) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Перевірки: чи вже друзі, чи вже є запит
        if (recipient.friends.includes(senderId)) {
            return res.status(400).json({ message: 'Already friends' });
        }
        if (recipient.friendRequestsReceived.includes(senderId)) {
            return res.status(400).json({ message: 'Friend request already sent' });
        }
        if (recipient.friendRequestsSent.includes(senderId)) {
            return res.status(400).json({ message: 'This user already sent you a request. Accept it instead.' });
        }

        // Додаємо запит
        recipient.friendRequestsReceived.push(senderId);
        sender.friendRequestsSent.push(recipientId);

        await recipient.save();
        await sender.save();

        res.status(200).json({ message: 'Friend request sent successfully' });

    } catch (error) {
        console.error("Send friend request error:", error);
        res.status(500).json({ message: 'Error sending friend request' });
    }
};

// Прийняти запит у друзі
export const acceptFriendRequest = async (req, res) => {
    const senderId = req.params.userId; // ID того, хто надіслав запит
    const recipientId = req.user._id; // ID поточного користувача (хто приймає)

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
        return res.status(400).json({ message: 'Invalid sender ID' });
    }

    try {
        const recipient = await User.findById(recipientId);
        const sender = await User.findById(senderId);

        if (!recipient || !sender) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Перевірка, чи є такий запит
        if (!recipient.friendRequestsReceived.includes(senderId)) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        // Додаємо один одного в друзі
        recipient.friends.push(senderId);
        sender.friends.push(recipientId);

        // Видаляємо запит зі списків
        recipient.friendRequestsReceived = recipient.friendRequestsReceived.filter(id => !id.equals(senderId));
        sender.friendRequestsSent = sender.friendRequestsSent.filter(id => !id.equals(recipientId));

        await recipient.save();
        await sender.save();

        res.status(200).json({ message: 'Friend request accepted' });

    } catch (error) {
        console.error("Accept friend request error:", error);
        res.status(500).json({ message: 'Error accepting friend request' });
    }
};

// Відхилити запит АБО видалити друга
export const rejectOrRemoveFriend = async (req, res) => {
    const targetUserId = req.params.userId; // ID друга або того, хто надіслав запит
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
    }
    if (currentUserId.equals(targetUserId)) {
        return res.status(400).json({ message: "Action cannot be performed on yourself" });
    }

    try {
        const currentUser = await User.findById(currentUserId);
        const targetUser = await User.findById(targetUserId);

        if (!currentUser || !targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        let actionTaken = null;

        // 1. Перевіряємо, чи є запит для відхилення
        if (currentUser.friendRequestsReceived.includes(targetUserId)) {
            currentUser.friendRequestsReceived = currentUser.friendRequestsReceived.filter(id => !id.equals(targetUserId));
            targetUser.friendRequestsSent = targetUser.friendRequestsSent.filter(id => !id.equals(currentUserId));
            actionTaken = 'rejected';
        }
        // 2. Або перевіряємо, чи це запит, який ми надсилали (скасування)
        else if (currentUser.friendRequestsSent.includes(targetUserId)) {
            currentUser.friendRequestsSent = currentUser.friendRequestsSent.filter(id => !id.equals(targetUserId));
            targetUser.friendRequestsReceived = targetUser.friendRequestsReceived.filter(id => !id.equals(currentUserId));
            actionTaken = 'cancelled';
        }
        // 3. Або перевіряємо, чи вони друзі для видалення
        else if (currentUser.friends.includes(targetUserId)) {
            currentUser.friends = currentUser.friends.filter(id => !id.equals(targetUserId));
            targetUser.friends = targetUser.friends.filter(id => !id.equals(currentUserId));
            actionTaken = 'removed';
        } else {
            return res.status(404).json({ message: 'No pending request or existing friendship found with this user' });
        }


        await currentUser.save();
        await targetUser.save();

        res.status(200).json({ message: `Friendship ${actionTaken} successfully` });

    } catch (error) {
        console.error("Reject/Remove friend error:", error);
        res.status(500).json({ message: 'Error processing request' });
    }
};

// Отримати список друзів поточного користувача
export const getFriends = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('friends', 'name email'); // Завантажуємо імена та email друзів

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user.friends);
    } catch (error) {
        console.error("Get friends error:", error);
        res.status(500).json({ message: 'Error fetching friends list' });
    }
};

// Отримати список отриманих запитів у друзі
export const getFriendRequests = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .populate('friendRequestsReceived', 'name email'); // Завантажуємо дані тих, хто надіслав запит

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user.friendRequestsReceived);
    } catch (error) {
        console.error("Get friend requests error:", error);
        res.status(500).json({ message: 'Error fetching friend requests' });
    }
};

// Отримати список перегляду ДРУГА (з перевіркою приватності)
export const getFriendWatchlist = async (req, res) => {
    const friendId = req.params.userId;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
        return res.status(400).json({ message: 'Invalid friend ID' });
    }

    try {
        const friend = await User.findById(friendId).select('friends watchlistPrivacy');
        if (!friend) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Перевірка доступу
        let canViewWatchlist = false;
        if (friend.watchlistPrivacy === 'public') {
            canViewWatchlist = true;
        } else if (friend.watchlistPrivacy === 'friendsOnly' && friend.friends.some(id => id.equals(currentUserId))) {
            canViewWatchlist = true;
        } else if (currentUserId.equals(friend._id)) { // Якщо користувач дивиться свій список через цей ендпоінт
            canViewWatchlist = true;
        }


        if (!canViewWatchlist) {
            return res.status(403).json({ message: 'Access denied. This user\'s watchlist is private or for friends only.' });
        }

        // Логіка отримання списку аналогічна getWatchlist, але для friendId
        const { status, sortBy, sortOrder = 'desc', page = 1, limit = 20 } = req.query;
        const query = { user: friendId };
        if (status) query.status = status;

        const sortOptions = {};
        if (sortBy) {
            const allowedSortFields = ['createdAt', 'updatedAt', 'dateCompleted', 'userRating', 'releaseDate', 'title'];
            if (allowedSortFields.includes(sortBy)) {
                sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
            } // Можна ігнорувати невалідні поля сортування для публічного перегляду
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
            items: itemsWithPoster,
            currentPage: pageNum,
            totalPages: Math.ceil(totalItems / limitNum),
            totalItems
        });


    } catch (error) {
        console.error("Get friend watchlist error:", error);
        res.status(500).json({ message: 'Error fetching friend\'s watchlist' });
    }
};

// --- Статистика та Аналіз ---

// Генерація статистики для поточного користувача
export const getUserStats = async (req, res) => {
    const userId = req.user._id;

    try {
        const allItems = await WatchlistItem.find({ user: userId }).lean();

        if (!allItems.length) {
            return res.json({ message: 'No items in watchlist to generate stats.' });
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
            // Статистика для графіків активності (наприклад, завершено по місяцях)
            completionActivity: {}, // { 'YYYY-MM': count }
            // ... інша статистика
        };

        // Розрахунок середньої оцінки
        const ratedItems = allItems.filter(item => item.userRating && item.userRating > 0);
        if (ratedItems.length > 0) {
            const totalRating = ratedItems.reduce((sum, item) => sum + item.userRating, 0);
            stats.averageRating = parseFloat((totalRating / ratedItems.length).toFixed(1));
        }

        // Розрахунок улюблених жанрів
        const genreCounts = {};
        allItems.forEach(item => {
            item.genres?.forEach(genre => {
                genreCounts[genre] = (genreCounts[genre] || 0) + 1;
            });
        });
        stats.favoriteGenres = Object.entries(genreCounts)
            .sort(([, countA], [, countB]) => countB - countA) // Сортування за спаданням кількості
            .slice(0, 5) // Топ 5 жанрів
            .map(([genre, count]) => ({ genre, count }));

        // Розрахунок активності завершення по місяцях
        const completedItems = allItems.filter(item => item.status === 'completed' && item.dateCompleted);
        completedItems.forEach(item => {
            const monthYear = item.dateCompleted.toISOString().slice(0, 7); // 'YYYY-MM'
            stats.completionActivity[monthYear] = (stats.completionActivity[monthYear] || 0) + 1;
        });
        // Сортування активності за датою
        stats.completionActivity = Object.entries(stats.completionActivity)
            .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});


        res.json(stats);

    } catch (error) {
        console.error("Get user stats error:", error);
        res.status(500).json({ message: 'Error generating user statistics' });
    }
};


// --- Генерація Картинок (складно, вимагає додаткових бібліотек) ---
// Заглушки для функцій, реалізація потребує 'canvas' або 'puppeteer'
/*
export const generateShareImage = async (req, res) => {
    // 1. Отримати статистику користувача (викликати getUserStats або подібну логіку)
    // 2. Використовувати бібліотеку типу 'canvas' або 'puppeteer' для рендерингу статистики на фоновому зображенні/шаблоні
    // 3. Встановити правильний Content-Type ('image/png' або 'image/jpeg')
    // 4. Надіслати згенероване зображення у відповідь (res.send(buffer) або res.sendFile(path))
    res.status(501).json({ message: 'Image generation not implemented yet' });
};

export const generateRecommendationCard = async (req, res) => {
     // 1. Отримати ID елемента зі списку req.params.watchlistItemId
     // 2. Знайти цей елемент в базі даних WatchlistItem.findById(...)
     // 3. Перевірити, чи належить він користувачу req.user._id
     // 4. Отримати дані (постер, назва, опис, оцінка користувача)
     // 5. Використати бібліотеку для генерації зображення картки
     // 6. Надіслати зображення
     res.status(501).json({ message: 'Recommendation card generation not implemented yet' });
};
*/

// --- TODO: Рекомендації (дуже складно, опціонально) ---
// --- TODO: Нагадування (потребує планувальника завдань/cron) ---