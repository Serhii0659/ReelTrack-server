// server\controllers\contentController.js
import dotenv from 'dotenv';
dotenv.config(); // Завантажуємо змінні середовища на початку

import axios from 'axios'; // Імпортуємо axios

const TMDB_API_KEY = process.env.TMDB_API_KEY; // Отримуємо ключ з .env
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'; // Базовий URL API TMDB

// Контролер для пошуку фільмів та серіалів
export const searchContent = async (req, res) => {
    const searchQuery = req.query.query;

    if (!searchQuery) {
        return res.status(400).json({ message: 'Search query is required' });
    }

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/search/multi`, {
            params: {
                api_key: TMDB_API_KEY,
                query: searchQuery,
                language: 'uk-UA',
                include_adult: false
            }
        });

        const filteredResults = response.data.results.filter(
            item => item.media_type === 'movie' || item.media_type === 'tv'
        );

        const transformedResults = filteredResults.map(item => ({
            tmdbId: item.id,
            title: item.title || item.name,
            overview: item.overview,
            posterPath: item.poster_path,
            mediaType: item.media_type,
            releaseDate: item.release_date || item.first_air_date,
            voteAverage: item.vote_average,
        }));

        res.json(transformedResults);

    } catch (error) {
        console.error("Error searching TMDB:", error.response?.data?.status_message || error.message);
        if (error.response) {
             res.status(error.response.status).json({
                message: error.response.data.status_message || 'Error fetching from TMDB API',
                tmdb_status_code: error.response.data.status_code
            });
        } else {
            res.status(500).json({ message: 'Error searching content' });
        }
    }
};

// Контролер для отримання деталей фільму/серіалу за TMDB ID
export const getDetailsByTmdbId = async (req, res) => { // <<< ЗВЕРНИ УВАГУ НА 'export'
    const { mediaType, tmdbId } = req.params;

    console.log(`[Backend Trace] Received request for content: Type=${mediaType}, ID=${tmdbId}`);

    if (!mediaType || !tmdbId) {
        console.log('[Backend Trace] Validation failed: Missing mediaType or tmdbId.');
        return res.status(400).json({ message: 'Media type and TMDB ID are required.' });
    }

    if (mediaType !== 'movie' && mediaType !== 'tv') {
        console.log('[Backend Trace] Validation failed: Invalid mediaType.');
        return res.status(400).json({ message: 'Invalid media type. Must be "movie" or "tv".' });
    }

    try {
        const tmdbApiUrl = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,recommendations,reviews`;

        console.log(`[Backend Trace] Calling TMDB API: ${tmdbApiUrl}`);

        const response = await axios.get(tmdbApiUrl);

        console.log(`[Backend Trace] TMDB API Response Status: ${response.status}`);
        console.log(`[Backend Trace] TMDB API Response Data (first 100 chars): ${JSON.stringify(response.data).substring(0, 100)}...`);

        if (response.data.status_code === 34) {
            console.warn(`[Backend Trace] TMDB responded with 'resource not found' (status_code 34) for ${mediaType} ID ${tmdbId}.`);
            return res.status(404).json({ message: 'Content not found on TMDB.' }); 
        }
        
        res.status(200).json(response.data);

    } catch (error) {
        console.error(`[Backend Trace] Error fetching ${mediaType} details from TMDB for ID ${tmdbId}:`, error.message);
        if (error.response) {
            console.error('[Backend Trace] TMDB API Error Response Data:', error.response.data);
            res.status(error.response.status).json({ 
                message: error.response.data.status_message || 'Failed to fetch content details from TMDB.',
                tmdbErrorCode: error.response.data.status_code 
            });
        } else if (error.request) {
            res.status(500).json({ message: 'No response from TMDB API. Check network connection or TMDB API status.' });
        } else {
            res.status(500).json({ message: 'An unexpected error occurred while preparing the TMDB request.' });
        }
    }
};