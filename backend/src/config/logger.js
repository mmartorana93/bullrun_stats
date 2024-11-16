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
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../logs', 'combined.log')
        })
    ]
});

// Funzione per assicurarsi che la cartella logs esista
async function ensureLogDirectory() {
    try {
        await fs.mkdir(path.join(__dirname, '../../logs'), { recursive: true });
        logger.info('Directory logs creata/verificata con successo');
    } catch (error) {
        console.error('Errore nella creazione della directory logs:', error);
    }
}

// Funzione unificata per la scrittura dei log
async function writeLogToFile(filename, message) {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    await fs.appendFile(path.join(__dirname, '../../logs', filename), logMessage);
}

module.exports = {
    logger,
    ensureLogDirectory,
    writeLogToFile
};
