import mongoose from 'mongoose';

const WatchlistItemSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    mediaType: {
        type: String,
        required: true,
        enum: ['movie', 'tv'],
    },
    externalId: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    originalTitle: {
        type: String,
    },
    posterPath: {
        type: String,
    },
    releaseDate: {
        type: String,
    },
    overview: {
        type: String,
    },
    genres: [{
        type: String,
    }],
    language: {
        type: String,
    },
    runtime: {
        type: Number,
    },
    status: {
        type: String,
        required: true,
        enum: ['watching', 'completed', 'on_hold', 'dropped', 'plan_to_watch'],
        default: 'plan_to_watch',
        index: true,
    },
    userRating: {
        type: Number,
        min: 0,
        max: 10,
        index: true,
    },
    episodesWatched: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalEpisodes: {
        type: Number,
        min: 0,
        default: null,
    },
    totalSeasons: {
        type: Number,
    },
    dateAdded: {
        type: Date,
        default: Date.now,
    },
    dateStartedWatching: {
        type: Date,
        default: null,
    },
    dateCompleted: {
        type: Date,
        default: null,
        index: true,
    },
    userNotes: {
        type: String,
        trim: true,
        maxlength: 1000,
    },
    reminderDate: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

WatchlistItemSchema.index({ user: 1, externalId: 1 }, { unique: true });

export default mongoose.model('WatchlistItem', WatchlistItemSchema);