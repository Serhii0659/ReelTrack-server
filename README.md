# ReelTrack API Документація

## Базові налаштування

**Базовий URL:**
- Production server: `https://reeltrack-server-production.up.railway.app/api`
- Local server: `http://localhost:5000/api`

## Автентифікація
Для більшості ендпоінтів необхідний Bearer токен у заголовку `Authorization`. Отримати токен можна через:
- Вхід в систему (`/auth/login`)
- Оновлення токену (`/auth/refresh`)

## Формат відповіді
Всі відповіді повертаються у форматі JSON.

**Успішні відповіді:**
- `200` - для GET, PUT запитів
- `201` - для успішного POST
- `204` - для DELETE без тіла відповіді
- `200` - для DELETE з повідомленням

**Помилки:**
- `4xx` - помилки клієнта
- `5xx` - помилки сервера

Формат помилки:
```json
{
  "message": "Опис помилки"
}
```

---

## 1. Автентифікація (`/auth`)

### POST `/auth/register` (Публічний)
Реєстрація нового користувача.
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "password": "password123"
}
```
**Успіх:** `201`
```json
{ "message": "User registered successfully" }
```
**Помилка:** `400`
```json
{ "message": "Validation errors or user exists" }
```

---

### POST `/auth/login` (Публічний)
Вхід користувача.
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "password123"
}
```
**Успіх:** `200`
```json
{
  "message": "Login successful",
  "accessToken": "<JWT access token>",
  "refreshToken": "<refresh token>",
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "user"
  }
}
```
**Помилка:** `401`
```json
{ "message": "Invalid credentials" }
```

---

### POST `/auth/refresh` (Публічний)
Оновлення access/refresh токену.
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh token>"
}
```
**Успіх:** `200`
```json
{
  "accessToken": "<new JWT access token>",
  "refreshToken": "<new refresh token>"
}
```
**Помилка:** `401` або `403`
```json
{ "message": "Invalid or expired refresh token" }
```

---

### GET `/auth/verify-token` (Публічний)
Перевірка валідності access токену.
```http
GET /auth/verify-token
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{
  "isValid": true,
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "role": "user"
  },
  "message": "Token is valid"
}
```
**Помилка:** `401`
```json
{ "isValid": false, "message": "Invalid or expired token" }
```

---

### POST `/auth/logout` (Публічний)
Вихід користувача (анулює refresh токен).
```http
POST /auth/logout
Content-Type: application/json

{
  "refreshToken": "<refresh token>"
}
```
**Успіх:** `200`
```json
{ "message": "Logged out successfully" }
```

---

## 2. Профіль та Користувачі (`/users`) (Потребує Auth)

### GET `/users/profile`
Отримати профіль поточного користувача.
```http
GET /users/profile
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{
  "_id": "...",
  "name": "...",
  "email": "...",
  "avatarUrl": "...",
  "watchlistPrivacy": "...",
  "isAdmin": false
}
```

---

### PUT `/users/profile`
Оновити профіль (можна з аватаром, multipart/form-data).
```http
PUT /users/profile
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data

// Поля: name, email, password, watchlistPrivacy, avatar (файл)
```
**Успіх:** `200`
```json
{
  "_id": "...",
  "name": "...",
  "email": "...",
  "avatarUrl": "...",
  "watchlistPrivacy": "public"
}
```

---

### GET `/users/:userId/profile`
Публічний профіль іншого користувача.
```http
GET /users/:userId/profile
```
**Успіх:** `200`
```json
{
  "_id": "...",
  "name": "...",
  "avatarUrl": "...",
  "isPrivate": true,
  "watchlistPrivacy": "private"
}
```

---

### GET `/users/:userId/watchlist`
Отримати список перегляду іншого користувача (з урахуванням приватності).
```http
GET /users/:userId/watchlist?status=completed&page=1&limit=20
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{
  "friendName": "...",
  "items": [ { /* WatchlistItem */ }, ... ],
  "currentPage": 1,
  "totalPages": 2,
  "totalItems": 25
}
```

---

### GET `/users/search?q=...`
Пошук користувача за ID (або ім'ям, якщо реалізовано).
```http
GET /users/search?q=<userId>
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
[
  { "_id": "...", "name": "...", "avatarUrl": "..." }
]
```

---

## 3. Друзі (`/friends`) (Потребує Auth)

### GET `/friends`
Список друзів поточного користувача.
```http
GET /friends
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
[
  { "_id": "...", "name": "...", "avatarUrl": "..." }
]
```

---

### POST `/friends/request/:userId`
Надіслати запит у друзі.
```http
POST /friends/request/:userId
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{ "message": "Friend request sent successfully" }
```

---

### PUT `/friends/request/:userId/accept`
Прийняти запит у друзі.
```http
PUT /friends/request/:userId/accept
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{ "message": "Friend request accepted" }
```

---

### PUT `/friends/request/:userId/reject`
Відхилити запит у друзі.
```http
PUT /friends/request/:userId/reject
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{ "message": "Friendship rejected/cancelled/removed successfully" }
```

---

### DELETE `/friends/:userId`
Видалити друга.
```http
DELETE /friends/:userId
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{ "message": "Friendship removed successfully" }
```

---

### GET `/friends/requests`
Список вхідних запитів у друзі.
```http
GET /friends/requests
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
[
  { "_id": "...", "name": "...", "avatarUrl": "..." }
]
```

---

### GET `/friends/:userId/watchlist`
Список перегляду друга (з урахуванням приватності).
```http
GET /friends/:userId/watchlist
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{
  "friendName": "...",
  "items": [ { /* WatchlistItem */ }, ... ],
  "currentPage": 1,
  "totalPages": 2,
  "totalItems": 25
}
```

---

## 4. Пошук Медіа (`/media`)

### GET `/media/search`
Пошук фільмів/серіалів через TMDB.
```http
GET /media/search?query=Inception&type=movie
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
[
  {
    "id": 123,
    "title": "Inception",
    "media_type": "movie",
    "poster_path": "...",
    "poster_full_url": "https://image.tmdb.org/t/p/w500/...",
    ...
  }
]
```

---

## 5. Список Перегляду (`/watchlist`) (Потребує Auth)

### GET `/watchlist`
Отримати список перегляду поточного користувача.
```http
GET /watchlist?status=completed&page=1&limit=20
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{
  "items": [ { /* WatchlistItem */ }, ... ],
  "currentPage": 1,
  "totalPages": 2,
  "totalItems": 25
}
```

---

### POST `/watchlist/toggle`
Додати або видалити контент зі списку перегляду.
```http
POST /watchlist/toggle
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "externalId": "12345",
  "mediaType": "movie"
}
```
**Успіх (додавання):** `201`
```json
{
  "message": "Контент успішно додано до списку перегляду",
  "item": { /* WatchlistItem */ },
  "action": "added",
  "added": true
}
```
**Успіх (видалення):** `200`
```json
{
  "message": "Контент успішно видалено зі списку перегляду",
  "action": "removed",
  "added": false
}
```

---

### PUT `/watchlist/:id`
Оновити елемент списку перегляду.
```http
PUT /watchlist/:id
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "status": "completed",
  "userRating": 8,
  "episodesWatched": 10,
  "userNotes": "Дуже сподобалось!",
  "dateStartedWatching": "2024-01-01",
  "dateCompleted": "2024-01-10",
  "reminderDate": "2024-02-01"
}
```
**Успіх:** `200`
```json
{ /* Оновлений WatchlistItem */ }
```

---

### DELETE `/watchlist/:id`
Видалити елемент зі списку перегляду.
```http
DELETE /watchlist/:id
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{ "message": "Watchlist item deleted successfully" }
```

---

### GET `/watchlist/:id`
Отримати деталі одного елемента списку перегляду.
```http
GET /watchlist/:id
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{ /* WatchlistItem */ }
```

---

## 6. Статистика (`/users/stats`) (Потребує Auth)

### GET `/users/stats`
Отримати статистику користувача.
```http
GET /users/stats
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{
  "stats": {
    "totalItems": 25,
    "moviesCount": 10,
    "tvShowsCount": 15,
    "completedCount": 8,
    "watchingCount": 5,
    "planToWatchCount": 10,
    "onHoldCount": 1,
    "droppedCount": 1,
    "averageRating": 8.2,
    "favoriteGenres": [ { "genre": "Drama", "count": 7 }, ... ],
    "completionActivity": { "2024-01": 3, "2024-02": 2 }
  }
}
```

---

## 7. Відгуки (`/content/:mediaType/:tmdbId/reviews`) (Потребує Auth)

### GET `/content/:mediaType/:tmdbId/reviews`
Отримати всі відгуки для контенту.
```http
GET /content/:mediaType/:tmdbId/reviews
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
[
  {
    "_id": "...",
    "reviewer": { "name": "...", "avatarUrl": "..." },
    "tmdbId": "...",
    "mediaType": "movie",
    "rating": 8,
    "comment": "...",
    "contentTitle": "...",
    "contentPosterPath": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

### POST `/content/:mediaType/:tmdbId/reviews`
Додати відгук до контенту.
```http
POST /content/:mediaType/:tmdbId/reviews
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "rating": 8,
  "comment": "Дуже сподобалось!",
  "contentTitle": "...",
  "contentPosterPath": "..."
}
```
**Успіх:** `201`
```json
{
  "message": "Відгук успішно надіслано!",
  "review": { ... }
}
```

---

### PUT `/content/:mediaType/:tmdbId/reviews/:reviewId`
Оновити відгук.
```http
PUT /content/:mediaType/:tmdbId/reviews/:reviewId
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "rating": 9,
  "comment": "Оновлений коментар"
}
```
**Успіх:** `200`
```json
{
  "message": "Відгук успішно оновлено!",
  "review": { ... }
}
```

---

### GET `/content/:mediaType/:tmdbId/my-review`
Отримати свій відгук для контенту.
```http
GET /content/:mediaType/:tmdbId/my-review
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{
  "_id": "...",
  "reviewer": "...",
  "tmdbId": "...",
  "mediaType": "...",
  "rating": 8,
  "comment": "...",
  "contentTitle": "...",
  "contentPosterPath": "...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

### GET `/users/my-reviews`
Отримати всі свої відгуки.
```http
GET /users/my-reviews
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
[
  {
    "_id": "...",
    "tmdbId": "...",
    "mediaType": "...",
    "rating": 8,
    "comment": "...",
    "contentTitle": "...",
    "contentPosterPath": "...",
    "createdAt": "...",
    "updatedAt": "...",
    "poster_full_url": "..."
  }
]
```

---

### DELETE `/users/my-reviews/:reviewId`
Видалити свій відгук.
```http
DELETE /users/my-reviews/:reviewId
Authorization: Bearer <accessToken>
```
**Успіх:** `200`
```json
{ "message": "Відгук успішно видалено!" }
```

---

## 8. Додавання контенту до бібліотеки (`/users/library/add`) (Потребує Auth)

### POST `/users/library/add`
Додати контент до бібліотеки користувача.
```http
POST /users/library/add
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "tmdbId": "12345",
  "mediaType": "movie",
  "title": "Inception",
  "posterPath": "/path.jpg",
  "releaseDate": "2010-07-16",
  "genres": ["Action", "Sci-Fi"],
  "status": "plan_to_watch"
}
```
**Успіх:** `201`
```json
{
  "message": "Контент успішно додано до бібліотеки!",
  "item": { /* WatchlistItem */ }
}
```

---

## 9. Структура WatchlistItem

```json
{
  "_id": "...",
  "user": "...",
  "mediaType": "movie",
  "externalId": "12345",
  "title": "Inception",
  "originalTitle": "Inception",
  "posterPath": "/path.jpg",
  "poster_full_url": "https://image.tmdb.org/t/p/w500/path.jpg",
  "releaseDate": "2010-07-16",
  "overview": "...",
  "genres": ["Action", "Sci-Fi"],
  "language": "en",
  "runtime": 148,
  "status": "plan_to_watch",
  "userRating": 8,
  "episodesWatched": 0,
  "totalEpisodes": null,
  "totalSeasons": null,
  "dateAdded": "...",
  "dateStartedWatching": null,
  "dateCompleted": null,
  "userNotes": "",
  "reminderDate": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## 10. Примітки

- Всі приватні ендпоінти потребують заголовка `Authorization: Bearer <accessToken>`.
- Для multipart/form-data (оновлення профілю з аватаром) використовуйте поле `avatar`.
- Для роботи з TMDB API потрібен дійсний ключ у `.env` (`TMDB_API_KEY`).