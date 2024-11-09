import axios from 'axios';
import * as raxios from 'retry-axios';

// Configurazione del client axios con retry
const rugcheckClient = axios.create({
    baseURL: 'https://api.rugcheck.xyz/v1',
    timeout: 10000
});

// Configurazione del sistema di retry
const raxConfig = {
    retry: 3,
    noResponseRetries: 2,
    retryDelay: 1000,
    httpMethodsToRetry: ['GET'],
    statusCodesToRetry: [[408, 429], [500, 599]],
    backoffType: 'exponential' as const,
    onRetryAttempt: (err: any) => {
        const cfg = raxios.getConfig(err);
        console.log(`Retry attempt #${cfg?.currentRetryAttempt} for Rugcheck API`);
    }
};

rugcheckClient.defaults.raxConfig = raxConfig;
raxios.attach(rugcheckClient);

export interface RiskFlags {
    mutable_metadata: boolean;
    freeze_authority_enabled: boolean;
    mint_authority_enabled: boolean;
}

export interface RiskAnalysis {
    flags: RiskFlags;
    isSafeToBuy: boolean;
}

export const rugcheckService = {
    async analyzeToken(tokenAddress: string): Promise<RiskAnalysis> {
        try {
            const response = await rugcheckClient.get(`/tokens/${tokenAddress}/report`);
            const risks = response.data.risks || [];
            
            const riskFlags: RiskFlags = {
                mutable_metadata: false,
                freeze_authority_enabled: false,
                mint_authority_enabled: false
            };

            risks.forEach((risk: { name: string }) => {
                if (risk.name === "Mutable metadata") {
                    riskFlags.mutable_metadata = true;
                } else if (risk.name === "Freeze Authority still enabled") {
                    riskFlags.freeze_authority_enabled = true;
                } else if (risk.name === "Mint Authority still enabled") {
                    riskFlags.mint_authority_enabled = true;
                }
            });

            const isSafeToBuy = !Object.values(riskFlags).some(flag => flag);

            return {
                flags: riskFlags,
                isSafeToBuy
            };
        } catch (error) {
            console.error('Error analyzing token with Rugcheck:', error);
            throw error;
        }
    }
};
