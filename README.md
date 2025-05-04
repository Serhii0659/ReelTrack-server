# ReelTrack API Документація

## Базові налаштування

**Базовий URL:**
- Продукційний сервер: `https://reeltrack-server-production.up.railway.app/api`
- Локальний розвиток: `http://localhost:5000/api`

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
1. Автентифікація (/auth)

    POST /register (Публічний)
    ```POST
        Body (application/json):
        {
            "name": "John Doe",           // string, required
            "email": "john.doe@example.com", // string, required
            "password": "password123"     // string, required, min 6 chars
        }
        Success (201):
        {
            "message": "User registered successfully"
        }
        Error (400):
        {
            "message": "Validation errors or user exists"
        }
    ```
    POST /login (Публічний)
    ```POST
        Body (application/json):
        {
            "email": "john.doe@example.com", // string, required
            "password": "password123"        // string, required
        }
        Success (200):
        {
            "message": "Login successful",
            "accessToken": "<JWT access token>", // string
            "refreshToken": "<refresh token>",   // string
            "user": {
                "id": "...",     // string
                "name": "...",   // string
                "email": "...",  // string
                "role": "user"   // string
            }
        }
        Error (401):
        {
            "message": "Invalid credentials"
        }
    ```
    POST /refresh (Публічний)
    ```POST
        Body (application/json):
        {
            "refreshToken": "<refresh token>" // string, required
        }
        Success (200):
        {
            "accessToken": "<new JWT access token>", // string
            "refreshToken": "<new refresh token>"    // string
        }
        Error (401):
        {
            "message": "Invalid or expired refresh token"
        }
        Error (403):
        {
            "message": "Refresh token is required"
        }
    ```
    POST /logout (Публічний)
    ```POST
        Body (application/json):
        {
            "refreshToken": "<refresh token>" // string, required
        }
        Success (200):
        {
            "message": "Logged out successfully"
        }
        Error (400):
        {
            "message": "Refresh token is required"
        }
        Error (401):
        {
            "message": "Invalid refresh token"
        }
        Error (500):
        {
            "message": "Server error"
        }
    ```

2. Профіль та Користувачі (/users) (Потребує Auth)

    GET /profile
    ```GET
        Headers:
            Authorization: Bearer <accessToken>
        Success (200):
        {
            "id": "...",                  // string
            "name": "...",                // string
            "email": "...",               // string
            "role": "...",                // string
            "watchlistPrivacy": "...",    // string ('public'|'friendsOnly'|'private')
            "friends": [ ... ],           // array[string]
            "friendRequestsReceived": [ ... ], // array[string]
            "friendRequestsSent": [ ... ]      // array[string]
        }
        Error (401):
        {
            "message": "Unauthorized"
        }
    ```

    PUT /profile
    ```PUT
        Headers:
            Authorization: Bearer <accessToken>
        Body (application/json):
        {
            "name": "(optional)",                   // string
            "email": "(optional)",                  // string
            "password": "(optional, min 6 chars)",  // string
            "watchlistPrivacy": "(optional, 'public'/'friendsOnly'/'private')"
        }
        Success (200):
        {
            "id": "...",
            "name": "...",
            "email": "...",
            "role": "...",
            "watchlistPrivacy": "...",
            "friends": [...],
            "friendRequestsReceived": [...],
            "friendRequestsSent": [...]
        }
        Error (400):
        {
            "message": "Validation errors"
        }
        Error (401):
        {
            "message": "Unauthorized"
        }
    ```

    GET /{userId}/profile
    ```GET
        Headers:
            Authorization: Bearer <accessToken>
        Success (200):
        {
            "_id": "...",         // string
            "name": "...",        // string
            "isPrivate": true/false // boolean
        }
        Error (404):
        {
            "message": "User not found"
        }
    ```

    GET /{userId}/watchlist
    ```GET
        Headers:
            Authorization: Bearer <accessToken>
        Query Params:
            status, sortBy, sortOrder, page, limit
        Success (200):
        {
            "items": [...],         // array[object]
            "currentPage": ...,     // number
            "totalPages": ...,      // number
            "totalItems": ...       // number
        }
        Error (403):
        {
            "message": "Access denied"
        }
        Error (404):
        {
            "message": "User not found"
        }
    ```

3. Друзі (/users/friends) (Потребує Auth)

    POST /request/{userId}
    ```POST
        Headers:
            Authorization: Bearer <accessToken>
        Success (200):
        {
            "message": "Friend request sent successfully"
        }
        Error (400):
        {
            "message": "Invalid ID, already friends/requested"
        }
        Error (404):
        {
            "message": "User not found"
        }
    ```

    POST /accept/{userId}
    ```POST
        Headers:
            Authorization: Bearer <accessToken>
        Success (200):
        {
            "message": "Friend request accepted"
        }
        Error (404):
        {
            "message": "Request not found"
        }
    ```

    DELETE /remove/{userId}
    ```DELETE
        Headers:
            Authorization: Bearer <accessToken>
        Success (200):
        {
            "message": "Friendship rejected/cancelled/removed successfully"
        }
        Error (404):
        {
            "message": "No request or friendship found"
        }
    ```

    GET /
    ```GET
        Headers:
            Authorization: Bearer <accessToken>
        Success (200):
        [
            { "_id": "...", "name": "...", "email": "..." },
            ...
        ]
    ```

    GET /requests
    ```GET
        Headers:
            Authorization: Bearer <accessToken>
        Success (200):
        [
            { "_id": "...", "name": "...", "email": "..." },
            ...
        ]
    ```

4. Пошук Медіа (/media) (Потребує Auth)

    GET /search
    ```GET
        Headers:
            Authorization: Bearer <accessToken>
        Query Params:
            query (required, string), type (optional, 'movie'/'tv'/'multi', default 'multi')
        Success (200):
        [
            { /* TMDB item data */, "poster_full_url": "..." },
            ...
        ]
        Error (400):
        {
            "message": "Query parameter is missing"
        }
        Error (500):
        {
            "message": "TMDB API error"
        }
    ```

5. Список Перегляду (/watchlist) (Потребує Auth)

    POST /
    ```POST
        Headers:
            Authorization: Bearer <accessToken>
        Body (application/json):
        {
            "externalId": "...",      // string, required
            "mediaType": "movie" | "tv", // string, required
            "status": "(optional)"    // string
        }
        Success (201):
        {
            /* Новий елемент WatchlistItem з poster_full_url */
        }
        Error (400):
        {
            "message": "Missing fields, invalid type, already exists"
        }
        Error (404):
        {
            "message": "Media not found on TMDB"
        }
    ```

    GET /
    ```GET
        Headers:
            Authorization: Bearer <accessToken>
        Query Params:
            status, sortBy, sortOrder, page, limit
        Success (200):
        {
            "items": [ { /* WatchlistItem з poster_full_url */ }, ... ],
            "currentPage": ...,     // number
            "totalPages": ...,      // number
            "totalItems": ...       // number
        }
    ```

    PUT /{id}
    ```PUT
        Headers:
            Authorization: Bearer <accessToken>
        Body:
        {
            "status": "(optional)",
            "userRating": (optional, 0-10),
            "episodesWatched": (optional, number),
            "userNotes": "(optional, string)",
            "dateStartedWatching": "(optional, ISO Date string)",
            "dateCompleted": "(optional, ISO Date string)",
            "reminderDate": "(optional, ISO Date string)"
        }
        Success (200):
        {
            /* Оновлений WatchlistItem з poster_full_url */
        }
        Error (400):
        {
            "message": "Invalid data"
        }
        Error (404):
        {
            "message": "Item not found or permission denied"
        }
    ```

    DELETE /{id}
    ```DELETE
        Headers:
            Authorization: Bearer <accessToken>
        Success (200):
        {
            "message": "Watchlist item deleted successfully"
        }
        Error (404):
        {
            "message": "Item not found or permission denied"
        }
    ```

6. Статистика (/users/stats) (Потребує Auth)

    GET /
    ```GET
        Headers:
            Authorization: Bearer <accessToken>
        Success (200):
        {
            "totalItems": ...,           // number
            "moviesCount": ...,          // number
            "tvShowsCount": ...,         // number
            "completedCount": ...,       // number
            "averageRating": ...,        // number
            "favoriteGenres": [ { "genre": "...", "count": ... } ], // array [object]
            "completionActivity": { "YYYY-MM": count, ... }         // object
        }
        Error (401):
        {
            "message": "Unauthorized"
        }
        Error (500):
        {
            "message": "Error generating stats"
        }
    ```