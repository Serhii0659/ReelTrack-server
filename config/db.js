// C:\Users\kreps\Documents\Projects\ReelTrack\server\config\db.js

import mongoose from 'mongoose'; // Важливо: використовуємо import, а не require

const connectDB = async () => {
    try {
        // Переконайтеся, що MONGODB_URI встановлено у вашому server/.env файлі
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1); // Вийти з процесу з помилкою
    }
};

export default connectDB; // Важливо: використовуємо export default