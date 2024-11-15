const { writeLogToFile } = require('../config/logger');

const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', async () => {
        const duration = Date.now() - start;
        const logMessage = `${req.method} ${req.url} ${res.statusCode} - ${duration}ms`;
        await writeLogToFile('http-requests.log', logMessage);
    });
    next();
};

module.exports = {
    requestLogger
};
