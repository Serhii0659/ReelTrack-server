import { searchMedia, getPosterUrl } from '../utils/tmdbHelper.js';

export const searchMediaController = async (req, res) => {
    const { query, type } = req.query;

    if (!query) {
        return res.status(400).json({ message: 'Search query is required' });
    }

    try {
        const results = await searchMedia(query, type || 'multi');
        const resultsWithPosterUrl = results.map(item => ({
            ...item,
            poster_full_url: getPosterUrl(item.poster_path)
        }));
        res.json(resultsWithPosterUrl);
    } catch (error) {
        console.error("Media search error:", error);
        res.status(500).json({ message: 'Error searching media' });
    }
};