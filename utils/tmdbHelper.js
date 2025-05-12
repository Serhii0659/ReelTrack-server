import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const tmdbAxiosInstance = axios.create({
    baseURL: TMDB_BASE_URL,
    params: {
        api_key: TMDB_API_KEY,
        language: 'uk-UA'
    }
});

export const searchMedia = async (query, type = 'multi') => {
    try {
        const response = await tmdbAxiosInstance.get(`/search/${type}`, {
            params: { query }
        });
        return response.data.results.filter(
            item => item.media_type === 'movie' || item.media_type === 'tv'
        );
    } catch (error) {
        console.error('Error searching TMDB:', error.response?.data || error.message);
        throw new Error('Failed to search media');
    }
};

export const getMediaDetails = async (mediaId, mediaType) => {
    try {
        const response = await tmdbAxiosInstance.get(`/${mediaType}/${mediaId}`, {
            params: { append_to_response: 'external_ids' }
        });
        return response.data;
    } catch (error) {
        console.error(`Error fetching TMDB ${mediaType} details:`, error.response?.data || error.message);
        throw new Error(`Failed to fetch ${mediaType} details`);
    }
};

export const getPosterUrl = (posterPath, size = 'w500') => {
    if (!posterPath) return null;
    const imageBaseUrl = 'https://image.tmdb.org/t/p/';
    return `${imageBaseUrl}${size}${posterPath}`;
};