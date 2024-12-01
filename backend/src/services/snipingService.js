const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fetch = require('node-fetch');
const { logger } = require('../config/logger');
const WalletService = require('./walletService');

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

      // 1. Ottieni la quotazione
      logger.info('Richiesta quotazione...');
      const quoteUrl = `${this.jupiterApiEndpoint}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
      logger.info('URL quotazione:', quoteUrl);

      const quoteResponse = await fetch(quoteUrl);
      if (!quoteResponse.ok) {
        const errorData = await quoteResponse.text();
        throw new Error(`Errore nella richiesta della quotazione: ${errorData}`);
      }

      const quoteData = await quoteResponse.json();
      logger.info('Quotazione ricevuta:', quoteData);

      // 2. Ottieni la transazione di swap
      logger.info('Richiesta transazione swap...');
      const swapRequestBody = {
        // Passa l'intera quotazione come richiesto dalla documentazione
        quoteResponse: quoteData,
        userPublicKey: walletKeypair.publicKey.toString(),
        // Configura le opzioni di swap
        wrapUnwrapSOL: true,
        // Opzioni aggiuntive per ottimizzare la transazione
        computeUnitPriceMicroLamports: 1000,
        asLegacyTransaction: true
      };

      logger.info('Body richiesta swap:', swapRequestBody);

      const swapResponse = await fetch(`${this.jupiterApiEndpoint}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(swapRequestBody)
      });

      if (!swapResponse.ok) {
        const errorData = await swapResponse.text();
        logger.error('Errore nella risposta di swap:', errorData);
        throw new Error(`Errore nella richiesta di swap: ${errorData}`);
      }

      const swapData = await swapResponse.json();
      logger.info('Risposta swap ricevuta:', swapData);

      // 3. Deserializza e firma la transazione
      logger.info('Preparazione della transazione...');
      const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
      const transaction = Transaction.from(swapTransactionBuf);

      // 4. Invia la transazione
      logger.info('Invio transazione...');
      const signedTx = await this.connection.sendTransaction(
        transaction,
        [walletKeypair],
        { 
          skipPreflight: true,
          maxRetries: 3,
          preflightCommitment: 'confirmed'
        }
      );

      logger.info('Transazione completata:', signedTx);
      return {
        success: true,
        transactionHash: signedTx,
        message: 'Swap eseguito con successo'
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
      
      const url = `${this.jupiterApiEndpoint}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;
      logger.info('URL quotazione:', url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.text();
        logger.error('Errore nella risposta della quotazione:', errorData);
        throw new Error(`Errore nella richiesta della quotazione: ${errorData}`);
      }

      const quoteData = await response.json();
      logger.info('Dati quotazione ricevuti:', quoteData);

      return {
        success: true,
        data: quoteData // Ritorna l'intera risposta della quotazione
      };

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
