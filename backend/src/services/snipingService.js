const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fetch = require('node-fetch');
const { logger } = require('../config/logger');
const WalletService = require('./walletService');
const raydiumService = require('./raydiumService');

class SnipingService {
  constructor() {
    this.connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
    this.jupiterApiEndpoint = 'https://quote-api.jup.ag/v6';
    this.walletService = new WalletService();
  }

  async executeSwap(params) {
    try {
      logger.info('Parametri ricevuti per lo swap:', params);
      const { inputMint, outputMint, amount, slippageBps } = params;
      
      // Validazione approfondita dei parametri
      if (!inputMint || !outputMint) {
        throw new Error('Indirizzi dei token mancanti');
      }

      if (!amount) {
        throw new Error('Amount non valido');
      }

      if (slippageBps === undefined || slippageBps === null || isNaN(slippageBps)) {
        throw new Error('Slippage non valido');
      }

      // Verifica che gli indirizzi dei token siano validi
      try {
        new PublicKey(inputMint);
        new PublicKey(outputMint);
      } catch (error) {
        throw new Error('Indirizzo token non valido');
      }

      // Usa il mainWallet dal WalletService
      const walletKeypair = this.walletService.mainWallet;
      if (!walletKeypair) {
        throw new Error('Wallet non disponibile');
      }

      // Determina se input/output sono SOL
      const isInputSol = inputMint === "So11111111111111111111111111111111111111112";
      const isOutputSol = outputMint === "So11111111111111111111111111111111111111112";

      // Esegui lo swap tramite Raydium
      const swapResult = await raydiumService.executeSwap(
        {
          inputMint,
          outputMint,
          amount,
          slippageBps,
          isInputSol,
          isOutputSol
        },
        walletKeypair
      );

      if (!swapResult.success) {
        throw new Error(swapResult.error);
      }

      return {
        success: true,
        transactionHash: swapResult.signatures[0], // Ritorna la prima signature
        message: 'Swap eseguito con successo tramite Raydium'
      };

    } catch (error) {
      logger.error('Errore dettagliato durante lo swap:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore sconosciuto durante lo swap'
      };
    }
  }

  async getQuote(inputMint, outputMint, amount) {
    try {
      // Validazione dei parametri
      if (!inputMint || !outputMint || !amount) {
        throw new Error('Parametri mancanti per la quotazione');
      }

      logger.info(`Richiesta quotazione per ${amount} da ${inputMint} a ${outputMint}`);
      
      // Ottieni quotazione tramite Raydium
      const quoteResult = await raydiumService.getQuote(
        inputMint,
        outputMint,
        amount,
        50 // slippage default
      );

      return quoteResult;

    } catch (error) {
      logger.error('Errore dettagliato nella quotazione:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Errore nel recupero della quotazione'
      };
    }
  }
}

module.exports = new SnipingService();
