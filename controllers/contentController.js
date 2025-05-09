// server\controllers\contentController.js
import axios from 'axios'; // Імпортуємо axios
import dotenv from 'dotenv'; // Імпортуємо dotenv для доступу до TMDB_API_KEY
dotenv.config(); // Завантажуємо змінні середовища

const TMDB_API_KEY = process.env.TMDB_API_KEY; // Отримуємо ключ з .env
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'; // Базовий URL API TMDB

// Контролер для пошуку фільмів та серіалів
export const searchContent = async (req, res) => {
    // Отримуємо пошуковий запит з параметрів URL (наприклад, /api/content/search?query=matrix)
    const searchQuery = req.query.query;

    if (!searchQuery) {
        return res.status(400).json({ message: 'Search query is required' });
    }

    try {
        // Виконуємо запит до API TMDB для мульти-пошуку (фільми, серіали, люди)
        // Використовуємо ендпоінт /search/multi
        const response = await axios.get(`${TMDB_BASE_URL}/search/multi`, {
            params: {
                api_key: TMDB_API_KEY,
                query: searchQuery,
                language: 'uk-UA', // Можна змінити мову, якщо потрібно
                // Додаткові параметри пошуку, якщо потрібні (наприклад, include_adult=false)
                include_adult: false
            }
        });

        // TMDB повертає результати у масиві 'results'
        // Ми можемо відфільтрувати результати, залишивши лише фільми та серіали
        const filteredResults = response.data.results.filter(
            item => item.media_type === 'movie' || item.media_type === 'tv'
        );

        // TODO: Можливо, трансформувати отримані дані, щоб вони мали зручніший для фронтенду формат
        // Наприклад, перейменувати id на tmdbId, додати повний URL постера тощо.
        const transformedResults = filteredResults.map(item => ({
            tmdbId: item.id,
            title: item.title || item.name, // Використовуємо 'title' для фільмів, 'name' для серіалів
            overview: item.overview,
            posterPath: item.poster_path,
            mediaType: item.media_type, // 'movie' або 'tv'
            releaseDate: item.release_date || item.first_air_date, // Дата виходу
            voteAverage: item.vote_average, // Середній рейтинг TMDB
            // TODO: Додати інші поля, які потрібні (жанри, актори тощо - для цього можуть знадобитись окремі запити або деталі)
        }));


        // Відправляємо відфільтровані та трансформовані результати на фронтенд
        res.json(transformedResults);

    } catch (error) {
        console.error("Error searching TMDB:", error.response?.data?.status_message || error.message);
        // Обробка помилок запиту до TMDB
        if (error.response) {
            // TMDB повернув помилку
             res.status(error.response.status).json({
                message: error.response.data.status_message || 'Error fetching from TMDB API',
                tmdb_status_code: error.response.data.status_code
            });
        } else {
            // Інші помилки (наприклад, мережі)
            res.status(500).json({ message: 'Error searching content' });
        }
    }
};

// TODO: Контролер для отримання деталей фільму/серіалу за TMDB ID
// export const getContentDetails = async (req, res) => { ... }