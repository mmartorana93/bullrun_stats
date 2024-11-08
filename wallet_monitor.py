import base58
from solders.keypair import Keypair
from solana.rpc.async_api import AsyncClient
import asyncio
from colorama import Fore, init

# Initialize colorama
init(autoreset=True)

class SolanaWalletMonitor:
    def __init__(self, private_key: str):
        self.wallet = Keypair.from_bytes(base58.b58decode(private_key))
        self.client = AsyncClient("https://api.mainnet-beta.solana.com")

    async def get_sol_balance(self) -> float:
        balance = await self.client.get_balance(pubkey=self.wallet.pubkey())
        return balance.value / 10**9  # Convert lamports to SOL

    async def display_wallet_info(self):
        balance = await self.get_sol_balance()
        print(f"{Fore.CYAN}Wallet Address: {self.wallet.pubkey()}")
        print(f"{Fore.GREEN}SOL Balance: {balance:.4f} SOL")

async def main():
    # Inserisci qui la tua private key
    PRIVATE_KEY = "3gAS4NoQ1N6QvxaHF9oA9B8RyRXK1eyhaQpk8M6aJhqmAtHaag2iDaE6nZADdrX63cKCoGNGhmci1XD5cn7gzZpd"
    
    monitor = SolanaWalletMonitor(PRIVATE_KEY)
    await monitor.display_wallet_info()
    await monitor.client.close()

if __name__ == "__main__":
    asyncio.run(main()) 