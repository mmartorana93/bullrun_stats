import aiohttp
import asyncio
import logging
from pathlib import Path

# Configura il logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def simulate_token_swap():
    """Simula uno swap di token usando le API del backend"""
    try:
        async with aiohttp.ClientSession() as session:
            # 1. Verifica che il server sia attivo
            async with session.get('http://localhost:5001/health') as response:
                if response.status != 200:
                    raise Exception("Backend non raggiungibile")
                logger.info("Backend raggiungibile")

            # 2. Ottieni info sul wallet di test
            async with session.get('http://localhost:5001/api/wallets/my-wallet?useTestKey=true') as response:
                wallet_info = await response.json()
                logger.info(f"Wallet di test: {wallet_info['address']}")
                logger.info(f"Balance attuale: {wallet_info['balance']} SOL")

            # 3. Simula uno swap di token
            async with session.post('http://localhost:5001/api/wallets/simulate-swap', json={
                'useTestKey': True
            }) as response:
                result = await response.json()
                if 'error' in result:
                    raise Exception(f"Errore: {result['error']}")
                
                logger.info(f"Swap completato!")
                logger.info(f"Token: {result['tokenSymbol']}")
                logger.info(f"Token Address: {result['tokenAddress']}")
                logger.info(f"Amount In: {result['amountIn']} SOL")
                logger.info(f"Token Amount: {result['tokenAmount']} {result['tokenSymbol']}")
                logger.info(f"Signature: {result['signature']}")
                return result

    except Exception as e:
        logger.error(f"Errore durante la simulazione: {str(e)}")
        return None

if __name__ == "__main__":
    result = asyncio.run(simulate_token_swap())
    if result:
        print(f"\nSwap completato con successo!")