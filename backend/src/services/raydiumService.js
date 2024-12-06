const axios = require('axios');
const { Connection, Transaction, VersionedTransaction } = require('@solana/web3.js');
const { logger } = require('../config/logger');
const { API_URLS } = require('@raydium-io/raydium-sdk-v2');

class RaydiumService {
  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL);
  }

  async getPriorityFee() {
    try {
      const { data } = await axios.get(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`);
      return data.data.default;
    } catch (error) {
      logger.error('Errore nel recupero priority fee:', error);
      return { h: 1000 }; // valore di default
    }
  }

  async getQuote(inputMint, outputMint, amount, slippageBps) {
    try {
      logger.info('[RaydiumService] Richiesta quotazione:', {
        inputMint,
        outputMint,
        amount,
        slippageBps
      });

      const { data: swapResponse } = await axios.get(
        `${API_URLS.SWAP_HOST}/compute/swap-base-in`,
        {
          params: {
            inputMint,
            outputMint,
            amount,
            slippageBps,
            txVersion: 0
          }
        }
      );

      logger.info('[RaydiumService] Risposta quotazione ricevuta:', swapResponse);
      return {
        success: true,
        data: swapResponse
      };
    } catch (error) {
      logger.error('[RaydiumService] Errore quotazione:', error);
      if (error.response) {
        logger.error('[RaydiumService] Dettagli errore:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async executeSwap(params, walletKeypair) {
    try {
      logger.info('[RaydiumService] Richiesta swap:', {
        ...params,
        wallet: walletKeypair.publicKey.toString()
      });

      const { inputMint, outputMint, amount, slippageBps, isInputSol, isOutputSol } = params;
      
      // 1. Ottieni la quotazione
      const quoteResult = await this.getQuote(inputMint, outputMint, amount, slippageBps);
      if (!quoteResult.success) {
        throw new Error(quoteResult.error);
      }

      // 2. Ottieni priority fee
      const priorityFee = await this.getPriorityFee();

      // 3. Richiedi la transazione
      const { data: swapTransactions } = await axios.post(
        `${API_URLS.SWAP_HOST}/transaction/swap-base-in`,
        {
          computeUnitPriceMicroLamports: String(priorityFee.h),
          swapResponse: quoteResult.data,
          txVersion: 0, // legacy transaction
          wallet: walletKeypair.publicKey.toBase58(),
          wrapSol: isInputSol,
          unwrapSol: isOutputSol
        }
      );

      // 4. Deserializza e processa le transazioni
      const allTxBuf = swapTransactions.data.map(tx => Buffer.from(tx.transaction, 'base64'));
      const allTransactions = allTxBuf.map(txBuf => Transaction.from(txBuf));

      // 5. Firma ed esegui tutte le transazioni
      const signatures = [];
      for (const transaction of allTransactions) {
        const signature = await this.connection.sendTransaction(
          transaction,
          [walletKeypair],
          {
            skipPreflight: true,
            maxRetries: 3,
            preflightCommitment: 'confirmed'
          }
        );
        signatures.push(signature);
      }

      logger.info('[RaydiumService] Swap completato:', {
        signatures,
        message: 'Swap Raydium eseguito con successo'
      });

      return {
        success: true,
        signatures,
        message: 'Swap Raydium eseguito con successo'
      };

    } catch (error) {
      logger.error('[RaydiumService] Errore swap:', error);
      if (error.response) {
        logger.error('[RaydiumService] Dettagli errore swap:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

module.exports = new RaydiumService(); 