import mongoose from 'mongoose';

const reviewSchema = mongoose.Schema(
    {
        reviewer: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        tmdbId: {
            type: String,
            required: true,
        },
        mediaType: {
            type: String,
            required: true,
            enum: ['movie', 'tv'],
        },
        rating: {
            type: Number,
            required: true,
            min: 0,
            max: 10,
        },
        comment: {
            type: String,
            required: false,
        },
        contentTitle: {
            type: String,
            required: true,
        },
        contentPosterPath: {
            type: String,
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

const Review = mongoose.model('Review', reviewSchema);

export default Review;
