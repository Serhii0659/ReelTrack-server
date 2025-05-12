import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        // MONGODB_URI встановлено в .env файлі
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1); // Вийти з процесу з помилкою
    }
};

export default connectDB;