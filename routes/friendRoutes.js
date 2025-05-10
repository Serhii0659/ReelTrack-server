// C:\Users\kreps\Documents\Projects\ReelTrack\server\routes\friendRoutes.js

import express from 'express';
// Вам також потрібно буде імпортувати контролер друзів та middleware для авторизації
// після того, як ви їх створите. Наприклад:
// import { 
//     sendFriendRequest, 
//     acceptFriendRequest, 
//     rejectOrRemoveFriend, 
//     fetchFriends, 
//     fetchFriendRequests,
//     getUserFriendsWatchlist 
// } from '../controllers/friendController.js';
// import auth from '../middleware/auth.js'; 

const router = express.Router();

// --- Тимчасові маршрути-заглушки (ви можете замінити їх на логіку контролерів пізніше) ---

// Отримати список друзів поточного користувача
router.get('/', (req, res) => {
    // res.status(200).json(await fetchFriends(req.user.id)); // Якщо використовуєте auth middleware
    res.status(200).json({ message: 'Маршрут отримання друзів (логіка тимчасово відсутня)' });
});

// Надіслати запит на додавання в друзі
router.post('/request/:userId', (req, res) => {
    // res.status(200).json(await sendFriendRequest(req.user.id, req.params.userId));
    res.status(200).json({ message: `Маршрут надсилання запиту на дружбу користувачу ${req.params.userId} (логіка тимчасово відсутня)` });
});

// Отримати запити на додавання в друзі
router.get('/requests', (req, res) => {
    // res.status(200).json(await fetchFriendRequests(req.user.id));
    res.status(200).json({ message: 'Маршрут отримання запитів на дружбу (логіка тимчасово відсутня)' });
});

// Прийняти запит на додавання в друзі
router.put('/request/:requestId/accept', (req, res) => {
    // res.status(200).json(await acceptFriendRequest(req.params.requestId));
    res.status(200).json({ message: `Маршрут прийняття запиту на дружбу ${req.params.requestId} (логіка тимчасово відсутня)` });
});

// Відхилити запит на додавання в друзі або видалити друга
// Використовуйте HTTP DELETE для видалення ресурсів (друзів)
// Використовуйте HTTP PUT для оновлення статусу (відхилення запиту)
router.put('/request/:requestId/reject', (req, res) => {
    // res.status(200).json(await rejectOrRemoveFriend(req.params.requestId, true)); // true для відхилення запиту
    res.status(200).json({ message: `Маршрут відхилення запиту на дружбу ${req.params.requestId} (логіка тимчасово відсутня)` });
});

router.delete('/:friendId', (req, res) => {
    // res.status(200).json(await rejectOrRemoveFriend(req.params.friendId, false)); // false для видалення друга
    res.status(200).json({ message: `Маршрут видалення друга ${req.params.friendId} (логіка тимчасово відсутня)` });
});

// Отримати список перегляду друга
router.get('/:friendId/watchlist', (req, res) => {
    // res.status(200).json(await getUserFriendsWatchlist(req.params.friendId));
    res.status(200).json({ message: `Маршрут отримання списку перегляду друга ${req.params.friendId} (логіка тимчасово відсутня)` });
});


export default router; // Важливо: експортуємо роутер за замовчуванням