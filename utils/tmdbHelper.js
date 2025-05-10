import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const tmdbAxiosInstance = axios.create({
    baseURL: TMDB_BASE_URL,
    params: {
        api_key: TMDB_API_KEY,
        language: 'uk-UA' // Можна зробити налаштовуваним
    }
});

// Функція пошуку
export const searchMedia = async (query, type = 'multi') => {
    try {
        // 'multi' шукає фільми, серіали та людей
        const response = await tmdbAxiosInstance.get(`/search/${type}`, {
            params: { query }
        });
        // Можна відфільтрувати результати, якщо потрібно лише фільми/серіали
        const filteredResults = response.data.results.filter(
            item => item.media_type === 'movie' || item.media_type === 'tv'
        );
        return filteredResults;
    } catch (error) {
        console.error('Error searching TMDB:', error.response?.data || error.message);
        throw new Error('Failed to search media');
    }
};

// Функція отримання деталей
export const getMediaDetails = async (mediaId, mediaType) => {
    try {
                const response = await tmdbAxiosInstance.get(`/${mediaType}/${mediaId}`, {
            params: {
                append_to_response: 'external_ids'
            }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching TMDB ${mediaType} details:`, error.response?.data || error.message);
        throw new Error(`Failed to fetch ${mediaType} details`);
    }
};

// Функція для побудови повного URL постера
export const getPosterUrl = (posterPath, size = 'w500') => {
    if (!posterPath) return null;
    // Потрібно отримати базовий URL зображень з конфігурації TMDB
    // Для простоти поки що захардкодимо, але краще отримувати динамічно
    const imageBaseUrl = 'https://image.tmdb.org/t/p/';
    return `${imageBaseUrl}${size}${posterPath}`;
};