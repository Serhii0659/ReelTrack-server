// C:\Users\kreps\Documents\ReelTrack\server\models\User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// === ДОДАНО: Схема для елемента бібліотеки ===
const libraryItemSchema = new mongoose.Schema({
    tmdbId: {
        type: Number,
        required: true,
    },
    mediaType: {
        type: String, // 'movie' або 'tv'
        required: true,
        enum: ['movie', 'tv']
    },
    status: {
        type: String,
        required: true,
        enum: ['planning', 'watching', 'completed', 'dropped'], // Приклади статусів
        default: 'planning'
    },
    addedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false }); // _id: false означає, що Mongoose не додаватиме ObjectId до кожного елемента масиву


const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/\S+@\S+\.\S+/, 'Please use a valid email address'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters long'],
    },
    name: { // Твоє існуюче поле 'name'
        type: String,
        required: [true, 'Name is required'],
        minlength: [2, 'Name must be at least 2 characters long'],
        maxlength: [50, 'Name must be at most 50 characters long'],
    },
    role: {
        type: String,
        enum: ['user', 'admin'], // Можливі ролі
        default: 'user',
    },
    refreshToken: {
        type: String,
        default: null,
    },
    // >>> ТВОЇ ІСНУЮЧІ ПОЛЯ ДЛЯ ДРУЗІВ ТА ЗАПИТІВ <<<
    friends: [ // Список друзів
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Посилання на іншу модель User
        },
    ],
    friendRequestsSent: [ // Запити в друзі, які відправив цей користувач
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Посилання на іншу модель User
        },
    ],
    friendRequestsReceived: [ // Запити в друзі, які отримав цей користувач
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Посилання на іншу модель User
        },
    ],
    // >>> КІНЕЦЬ ІСНУЮЧИХ ПОЛІВ <<<

    // === ДОДАНО: Поле для бібліотеки контенту ===
    library: [libraryItemSchema] // <<< НОВЕ ПОЛЕ

}, { timestamps: true }); // Додає createdAt та updatedAt

// Middleware (hook) для хешування пароля перед збереженням
UserSchema.pre('save', async function (next) {
    // Хешуємо пароль, тільки якщо він був змінений (або новий)
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Метод для порівняння введеного пароля з хешованим у базі
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', UserSchema); // Створюємо модель User на основі схеми