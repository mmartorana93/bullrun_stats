import asyncio
from solana.rpc.async_api import AsyncClient
from solders.keypair import Keypair
import os
from dotenv import load_dotenv
import base58
from pathlib import Path

async def request_airdrop():
    # Trova il percorso del file .env
    current_dir = Path(__file__).parent
    possible_env_paths = [
        current_dir.parent / 'backend' / '.env',  # ../backend/.env
        current_dir.parent / '.env',              # ../.env
        current_dir / '.env',                     # ./.env
    ]

    env_file = None
    for path in possible_env_paths:
        if path.exists():
            env_file = path
            print(f"Trovato file .env in: {path}")
            break

    if not env_file:
        raise Exception(f"File .env non trovato. Cercato in: {[str(p) for p in possible_env_paths]}")

    # Carica le variabili d'ambiente
    load_dotenv(dotenv_path=env_file)
    
    # Prova diverse chiavi possibili
    private_key = os.getenv('TEST_WALLET_PRIVATE_KEY') or \
                 os.getenv('SOLANA_PRIVATE_KEY_TEST') or \
                 os.getenv('WALLET_PRIVATE_KEY')

    if not private_key:
        raise Exception("""
        Chiave privata non trovata nel .env. 
        Assicurati che una delle seguenti variabili sia presente:
        - TEST_WALLET_PRIVATE_KEY
        - SOLANA_PRIVATE_KEY_TEST
        - WALLET_PRIVATE_KEY
        """)

    # Inizializza il client devnet
    client = AsyncClient("https://api.devnet.solana.com")
    
    try:
        # Crea il keypair dal private key
        keypair = Keypair.from_bytes(base58.b58decode(private_key))
        print(f"Wallet address: {keypair.pubkey()}")
        
        # Verifica balance iniziale
        initial_balance = await client.get_balance(keypair.pubkey())
        print(f"Balance iniziale: {initial_balance.value / 1_000_000_000} SOL")
        
        # Richiedi 2 SOL (2 miliardi di lamports)
        print(f"\nRichiedo airdrop di 2 SOL...")
        result = await client.request_airdrop(
            keypair.pubkey(), 
            2_000_000_000,  # 2 SOL in lamports
            commitment="confirmed"
        )
        
        print(f"Airdrop richiesto! Signature: {result.value}")
        
        # Aspetta la conferma
        await client.confirm_transaction(result.value)
        print("Airdrop confermato!")
        
        # Verifica il nuovo balance
        new_balance = await client.get_balance(keypair.pubkey())
        print(f"\nNuovo balance: {new_balance.value / 1_000_000_000} SOL")
        print(f"Incremento: {(new_balance.value - initial_balance.value) / 1_000_000_000} SOL")
        
    except Exception as e:
        print(f"Errore durante l'airdrop: {e}")
    finally:
        await client.close()

if __name__ == "__main__":
    asyncio.run(request_airdrop()) 