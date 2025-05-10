// C:\Users\kreps\Documents\Projects\ReelTrack\server\models\reviewModel.js
import mongoose from 'mongoose';

const reviewSchema = mongoose.Schema(
    {
        reviewer: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User', // Посилається на модель користувача
        },
        mediaType: {
            type: String,
            required: true,
            enum: ['movie', 'tv'], // Тип контенту: фільм або серіал
        },
        tmdbId: {
            type: Number, // Або String, якщо твій TMDB ID може бути не числом
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 10,
        },
        comment: {
            type: String,
            default: '', // Коментар може бути порожнім
        },
        // Можливо, ти захочеш зберігати назву та постер для швидшого відображення
        // contentTitle: { type: String },
        // contentPosterPath: { type: String },
    },
    {
        timestamps: true, // Додає поля createdAt та updatedAt
    }
);

const Review = mongoose.model('Review', reviewSchema);

export default Review;