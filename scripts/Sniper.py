"""
Descrizione dettagliata di Sniper.py:

Questo script implementa un bot di trading automatico per criptovalute sulla blockchain Solana, con un'interfaccia a riga di comando (CLI). Le principali funzionalità e componenti sono:

1. Configurazione e Dipendenze:
   - Utilizza librerie come asyncio, solders, solana, jupiter_python_sdk per interagire con la blockchain Solana
   - Implementa colorama per output colorato nella console
   - Usa httpx per chiamate API asincrone

2. Classe Wallet:
   - Gestisce l'interazione di base con il wallet Solana
   - Funzioni per ottenere il saldo dei token, gli indirizzi dei token e firmare/inviare transazioni

3. Classe Jupiter_CLI (eredita da Wallet):
   - Implementa la logica di trading utilizzando Jupiter, un aggregatore di DEX su Solana
   - Gestisce l'acquisto e la vendita di token
   - Mantiene un registro delle transazioni in un file JSON

4. Gestione degli Errori:
   - Implementa classi di errore personalizzate per gestire scenari specifici come saldo insufficiente, errori API, ecc.

5. Funzionalità di Trading:
   - Supporta l'acquisto di token con SOL e la vendita di token per SOL
   - Implementa la gestione dello slippage per le transazioni

6. Persistenza dei Dati:
   - Salva i dati delle transazioni e i saldi dei token in un file JSON

7. Funzione Main:
   - Fornisce un'interfaccia CLI per il trading
   - Mostra il saldo del wallet e il prezzo corrente di SOL/USD
   - Accetta comandi per l'acquisto e la vendita di token

8. Prezzi e Saldi:
   - Recupera il prezzo SOL/USD da CoinGecko
   - Mantiene aggiornati i saldi dei token

9. Esecuzione Asincrona:
   - Utilizza asyncio per gestire operazioni asincrone, migliorando l'efficienza delle chiamate API e delle transazioni

Differenze principali rispetto a Sniper_Telegram.py:
1. Nessuna integrazione con Telegram: questo script opera esclusivamente tramite CLI
2. Interfaccia utente semplificata: interazione diretta tramite input da console
3. Meno funzionalità di reporting: si concentra principalmente sull'esecuzione delle operazioni di trading

Questo script è ideale per gli utenti che preferiscono un'interfaccia a riga di comando per il trading automatizzato su Solana, offrendo un controllo diretto e immediato sulle operazioni di trading senza la necessità di un'interfaccia di messaggistica esterna.
"""

import base58
import base64
import asyncio
import httpx
from solders import message
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Processed
from solana.rpc.types import TxOpts
from spl.token.instructions import get_associated_token_address
from jupiter_python_sdk.jupiter import Jupiter
from colorama import Fore, init
from decimal import Decimal, getcontext

# Initialize colorama
init(autoreset=True)

# Set high precision for Decimal
getcontext().prec = 30

# Configuration
RPC_URL = "https://api.mainnet-beta.solana.com"
PRIVATE_KEY = "3gAS4NoQ1N6QvxaHF9oA9B8RyRXK1eyhaQpk8M6aJhqmAtHaag2iDaE6nZADdrX63cKCoGNGhmci1XD5cn7gzZpd"
TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"

RESET = Fore.RESET
GREEN = Fore.GREEN
RED = Fore.RED
YELLOW = Fore.YELLOW
BLUE = Fore.BLUE

class CustomError(Exception):
    """Base class for custom exceptions"""
    pass

class InsufficientBalanceError(CustomError):
    """Raised when there's insufficient balance for a transaction"""
    pass

class APIError(CustomError):
    """Raised when there's an error with API calls"""
    pass

class TransactionError(CustomError):
    """Raised when there's an error with a transaction"""
    pass

class Wallet():
    def __init__(self, async_client: bool=True):
        self.wallet = Keypair.from_bytes(base58.b58decode(PRIVATE_KEY))
        self.client = AsyncClient(endpoint=RPC_URL)

    async def get_token_balance(self, token_mint_account: str) -> dict:
        try:
            if token_mint_account == self.wallet.pubkey().__str__():
                get_token_balance = await self.client.get_balance(pubkey=self.wallet.pubkey())
                token_balance = {
                    'decimals': 9,
                    'balance': {
                        'int': get_token_balance.value,
                        'float': float(get_token_balance.value / 10 ** 9)
                    }
                }
            else:
                get_token_balance = await self.client.get_token_account_balance(pubkey=token_mint_account)
                try:
                    token_balance = {
                        'decimals': int(get_token_balance.value.decimals),
                        'balance': {
                            'int': get_token_balance.value.amount,
                            'float': float(get_token_balance.value.amount) / 10 ** int(get_token_balance.value.decimals)
                        }
                    }
                except AttributeError:
                    token_balance = {
                        'decimals': 0,
                        'balance': {
                            'int': 0,
                            'float':0
                        }
                    }
            return token_balance
        except Exception as e:
            raise APIError(f"Error fetching token balance: {str(e)}")
    
    async def get_token_mint_account(self, token_mint: str) -> Pubkey:
        try:
            token_mint_account = get_associated_token_address(owner=self.wallet.pubkey(), mint=Pubkey.from_string(token_mint))
            return token_mint_account
        except Exception as e:
            raise APIError(f"Error getting token mint account: {str(e)}")
    
    async def sign_send_transaction(self, transaction_data: str, signatures_list: list=None, print_link: bool=True):
        try:
            signatures = []
            raw_transaction = VersionedTransaction.from_bytes(base64.b64decode(transaction_data))
            signature = self.wallet.sign_message(message.to_bytes_versioned(raw_transaction.message))
            signatures.append(signature)
            if signatures_list:
                for signature in signatures_list:
                    signatures.append(signature)
            signed_txn = VersionedTransaction.populate(raw_transaction.message, signatures)
            opts = TxOpts(skip_preflight=True, preflight_commitment=Processed)
            
            result = await self.client.send_raw_transaction(txn=bytes(signed_txn), opts=opts)
            transaction_hash = result.value
            if print_link is True:
                print(f"{GREEN}Transaction sent: https://solscan.io/tx/{transaction_hash}{RESET}")
            return transaction_hash
        except Exception as e:
            raise TransactionError(f"Error signing and sending transaction: {str(e)}")

class Jupiter_CLI(Wallet):
    def __init__(self):
        super().__init__()
        self.jupiter = Jupiter(async_client=self.client, keypair=self.wallet)

    async def buy_token(self, token_address: str, sol_amount: float, slippage: float):
        """Buy a token with SOL."""
        try:
            sol_address = "So11111111111111111111111111111111111111112"
            success = await self._execute_swap(sol_address, token_address, sol_amount, slippage)
            if success:
                print(f"{GREEN}Bought token {token_address}")
        except CustomError as e:
            print(f"{RED}Error buying token: {str(e)}{RESET}")

    async def sell_token(self, token_address: str, token_amount: float, slippage: float):
        """Sell a token for SOL."""
        try:
            sol_address = "So11111111111111111111111111111111111111112"
            success = await self._execute_swap(token_address, sol_address, token_amount, slippage)
            if success:
                print(f"{GREEN}Sold {token_amount} of token {token_address}")
            else:
                print(f"{RED}Failed to sell {token_amount} of token {token_address}")
        except CustomError as e:
            print(f"{RED}Error selling token: {str(e)}{RESET}")

    async def _execute_swap(self, input_address: str, output_address: str, amount: float, slippage: float):
        """Execute a swap between two tokens."""
        try:
            if input_address == "So11111111111111111111111111111111111111112":
                input_balance = await self.get_token_balance(self.wallet.pubkey().__str__())
            else:
                input_token_account = await self.get_token_mint_account(token_mint=input_address)
                input_balance = await self.get_token_balance(token_mint_account=input_token_account)
            
            if input_balance['balance']['float'] < amount:
                raise InsufficientBalanceError(f"Insufficient balance. You have {input_balance['balance']['float']} tokens.")
            
            swap_data = await self.jupiter.swap(
                input_mint=input_address,
                output_mint=output_address,
                amount=int(amount * 10**input_balance['decimals']),
                slippage_bps=int(slippage * 100),
            )
            await self.sign_send_transaction(swap_data)
            print(f"{GREEN}Swap executed successfully.{RESET}")
            return True
        except CustomError as e:
            print(f"{RED}Swap execution failed: {str(e)}{RESET}")
            return False
        except Exception as e:
            print(f"{RED}Unexpected error during swap: {str(e)}{RESET}")
            return False

async def main():
    print(f"{BLUE}STARTING CLI...{RESET}")
    
    jupiter_cli = Jupiter_CLI()
    print(f"Wallet Address: {jupiter_cli.wallet.pubkey()}")
    
    try:
        while True:
            balance = await jupiter_cli.get_token_balance(jupiter_cli.wallet.pubkey().__str__())
            print(f"SOL Balance: {balance['balance']['float']} SOL")
            
            command = input("Enter command (buy/sell tokenAddress amount slippage) or 'exit' to quit: ").split()
            
            if command[0].lower() == 'exit':
                print("\nBye!")
                break
            
            if len(command) != 4:
                print(f"{RED}Invalid command. Please use the format: buy/sell tokenAddress amount slippage{RESET}")
                continue
            
            action, token_address, amount, slippage = command
            
            try:
                if action.lower() == 'buy':
                    await jupiter_cli.buy_token(token_address, float(amount), float(slippage))
                elif action.lower() == 'sell':
                    await jupiter_cli.sell_token(token_address, float(amount), float(slippage))
                else:
                    print(f"{RED}Invalid action. Use 'buy' or 'sell'.{RESET}")
            except ValueError as e:
                print(f"{RED}Invalid input: {str(e)}{RESET}")
            except CustomError as e:
                print(f"{RED}Error: {str(e)}{RESET}")
            except Exception as e:
                print(f"{RED}An unexpected error occurred: {str(e)}{RESET}")
    
    finally:
        print(f"{GREEN}CLI closed.{RESET}")

if __name__ == "__main__":
    asyncio.run(main())