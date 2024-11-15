const { logger } = require('../config/logger');

class TransactionTracker {
    constructor() {
        this.processedSignatures = new Set();
        this.setupCleanup();
    }

    setupCleanup() {
        // Pulizia delle signatures ogni ora
        setInterval(() => {
            const oldSize = this.processedSignatures.size;
            this.processedSignatures.clear();
            logger.info(`Cleaned ${oldSize} processed signatures`);
        }, 3600000);
    }

    isProcessed(signature) {
        return this.processedSignatures.has(signature);
    }

    markAsProcessed(signature) {
        this.processedSignatures.add(signature);
    }
}

module.exports = new TransactionTracker();
