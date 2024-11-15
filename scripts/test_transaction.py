from solders.keypair import Keypair
from solana.rpc.async_api import AsyncClient
from solana.transaction import Transaction
from solana.system_program import TransferParams, transfer
import asyncio
import base58
import os
from dotenv import load_dotenv

async def simulate_token_transaction():
    # Carica la chiave privata di test dal .env
    load_dotenv()
    private_key = os.getenv('SOLANA_PRIVATE_KEY_TEST')
    if not private_key:
        raise Exception("SOLANA_PRIVATE_KEY_TEST non trovata nel .env")

    # Inizializza il client devnet
    client = AsyncClient("https://api.devnet.solana.com")
    
    # Crea il keypair dal private key
    keypair = Keypair.from_bytes(base58.b58decode(private_key))
    
    # Crea un wallet di destinazione random per simulare lo swap
    destination = Keypair.generate()
    
    # Crea una transazione di test (invia 0.1 SOL)
    transaction = Transaction()
    transaction.add(transfer(
        TransferParams(
            from_pubkey=keypair.pubkey(),
            to_pubkey=destination.pubkey(),
            lamports=100000000  # 0.1 SOL
        )
    ))
    
    try:
        # Firma e invia la transazione
        result = await client.send_transaction(transaction, keypair)
        print(f"Transazione inviata! Signature: {result.value}")
        
        # Aspetta la conferma
        await client.confirm_transaction(result.value)
        print("Transazione confermata!")
        
    except Exception as e:
        print(f"Errore durante l'invio della transazione: {e}")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(simulate_token_transaction()) 