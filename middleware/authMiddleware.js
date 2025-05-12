import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import asyncHandler from 'express-async-handler';

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
        res.status(401);
        throw new Error('Not authorized, no token or malformed header');
    }

    try {
        token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = await User.findById(decoded.userId).select('-password -refreshToken');
        if (!req.user) {
            res.status(401);
            throw new Error('Not authorized, user not found');
        }
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            res.status(401);
            throw new Error('Not authorized, token expired');
        }
        res.status(401);
        throw new Error('Not authorized, token failed');
    }
});

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403);
        throw new Error('Not authorized as an admin');
    }
};

export { protect, admin };