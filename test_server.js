import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;
    console.log('\n--- TEST CORS DEBUGGING ---');
    console.log('Request Method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request Origin Header (from browser):', requestOrigin);

    res.setHeader('Access-Control-Allow-Origin', requestOrigin || 'http://localhost:5174'); // Або * для тесту
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin, Access-Control-Request-Headers');

    console.log('Attempting to set CORS headers manually in test server.');

    if (req.method === 'OPTIONS') {
        console.log('Sending 204 response for OPTIONS preflight from test server.');
        return res.sendStatus(204);
    }

    console.log('Proceeding to next middleware in test server.');
    next();
});

app.get('/', (req, res) => {
    res.send('Test API is working!');
});

app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});