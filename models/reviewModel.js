// server/models/reviewModel.js
import mongoose from 'mongoose';

const reviewSchema = mongoose.Schema(
    {
        // Посилання на користувача, який залишив відгук
        reviewer: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User', // Посилається на модель User
        },
        // Ідентифікатор контенту з TMDB
        tmdbId: {
            type: String, // Змінено на String, оскільки TMDB ID може бути рядком
            required: true,
        },
        // Тип контенту (movie або tv)
        mediaType: {
            type: String,
            required: true,
            enum: ['movie', 'tv'], // Обмежуємо можливі значення
        },
        // Оцінка користувача (від 0 до 10, або інший діапазон)
        rating: {
            type: Number,
            required: true,
            min: 0, // Змінено на 0, щоб дозволити оцінку 0 або без оцінки
            max: 10, // Максимальна оцінка (якщо використовуєте 10-бальну шкалу)
        },
        // Текст відгуку
        comment: {
            type: String,
            required: false, // Коментар може бути необов'язковим
            // default: '', // Видалено default, якщо required: false
        },
        // Зберігаємо деякі базові дані контенту для зручності (опціонально, але корисно для відображення)
        contentTitle: {
            type: String,
            required: true, // Назва контенту обов'язкова
        },
        contentPosterPath: {
            type: String,
            required: false, // Постер може бути необов'язковим
        },
        // Можливо, інші поля, які ви хочете зберегти з TMDB (наприклад, releaseDate, genres)
        // contentReleaseDate: { type: Date },
        // contentGenres: [{ type: String }],

    },
    {
        timestamps: true, // Додає поля createdAt та updatedAt
    }
);

const Review = mongoose.model('Review', reviewSchema);

export default Review;
