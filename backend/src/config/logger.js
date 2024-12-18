const winston = require('winston');
const path = require('path');
const fs = require('fs').promises;

// Configurazione logger
const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}] ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../logs', 'error.log'), 
            level: 'error',
            maxFiles: '2d',  // Mantiene i log per 2 giorni
            maxsize: 5242880 // 5MB per file
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../logs', 'combined.log'),
            maxFiles: '2d',
            maxsize: 5242880
        })
    ]
});

// Funzione per la pulizia dei log vecchi
async function cleanOldLogs() {
    try {
        const logsDir = path.join(__dirname, '../../logs');
        const files = await fs.readdir(logsDir);
        const now = Date.now();
        const twoDaysAgo = now - (48 * 60 * 60 * 1000);

        for (const file of files) {
            if (file.endsWith('.log')) {
                const filePath = path.join(logsDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.ctimeMs < twoDaysAgo) {
                    await fs.unlink(filePath);
                    logger.info(`Deleted old log file: ${file}`);
                }
            }
        }
    } catch (error) {
        logger.error('Error cleaning old logs:', error);
    }
}

// Funzione per assicurarsi che la cartella logs esista
async function ensureLogDirectory() {
    try {
        const logsDir = path.join(__dirname, '../../logs');
        await fs.mkdir(logsDir, { recursive: true });
        logger.info('Directory logs creata/verificata con successo');
        
        // Avvia la pulizia dei log vecchi
        await cleanOldLogs();
        
        // Programma la pulizia periodica dei log (ogni 12 ore)
        setInterval(cleanOldLogs, 12 * 60 * 60 * 1000);
    } catch (error) {
        logger.error('Errore nella creazione della directory logs:', error);
    }
}

// Funzione unificata per la scrittura dei log
async function writeLogToFile(filename, message) {
    const logPath = path.join(__dirname, '../../logs', filename);
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    
    try {
        await fs.appendFile(logPath, logMessage);
    } catch (error) {
        logger.error(`Error writing to log file ${filename}:`, error);
    }
}

module.exports = {
    logger,
    ensureLogDirectory,
    writeLogToFile
};
