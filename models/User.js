import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
    name: {
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

export default mongoose.model('User', UserSchema);