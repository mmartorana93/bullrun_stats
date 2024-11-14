interface TransactionLogData {
    timestamp: string;
    wallet: string;
    type: string;
    amount_sol: number;
    success: boolean;
    signature: string;
}

interface LPTrackingLogData {
    timestamp: string;
    tokenAccount: string;
    tokenAmount: number;
    solanaAmount: number;
    usdValue: number;
    txId: string;
    riskAnalysis?: any;
}

class LoggingService {
    private static async sendLogToBackend(endpoint: string, data: any): Promise<void> {
        try {
            await fetch(`/api/logs/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.error(`Error sending log to backend:`, error);
        }
    }

    static async logTransaction(data: TransactionLogData): Promise<void> {
        await this.sendLogToBackend('transaction', {
            timestamp: data.timestamp,
            wallet: data.wallet,
            type: data.type,
            amount_sol: data.amount_sol,
            success: data.success,
            signature: data.signature
        });
    }

    static async logLPTracking(data: LPTrackingLogData): Promise<void> {
        await this.sendLogToBackend('lptracking', {
            timestamp: data.timestamp,
            tokenAccount: data.tokenAccount,
            tokenAmount: data.tokenAmount,
            solanaAmount: data.solanaAmount,
            usdValue: data.usdValue,
            txId: data.txId,
            riskAnalysis: data.riskAnalysis
        });
    }
}

export default LoggingService;
