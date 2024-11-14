"""
Descrizione dettagliata di SOLWalletTracker.py:

Questo script implementa un sistema di monitoraggio in tempo reale per le transazioni di wallet Solana specifici, con analisi dei token e notifiche via Telegram. È simile agli altri tracker di wallet Solana, ma con alcune differenze chiave. Le principali funzionalità e componenti sono:

1. Configurazione e Dipendenze:
   - Utilizza asyncio per operazioni asincrone
   - Implementa websockets per connessioni WebSocket con la blockchain Solana
   - Usa aiohttp per richieste HTTP asincrone
   - Integra il client RPC asincrono di Solana per interazioni con la blockchain
   - Utilizza colorama per output colorato nella console

2. Logging:
   - Configura un sistema di logging che salva i log sia su file che li visualizza nella console

3. Connessione Websocket:
   - Stabilisce una connessione WebSocket con il nodo Solana per ricevere notifiche in tempo reale sulle transazioni

4. Analisi delle Transazioni:
   - Recupera i dettagli delle transazioni utilizzando l'API RPC di Solana
   - Analizza i saldi pre e post-transazione per determinare se si tratta di un acquisto o una vendita

5. Fetch dei Dettagli dei Token:
   - Utilizza l'API di DexScreener per ottenere informazioni dettagliate sui token coinvolti nelle transazioni

6. Notifiche Telegram:
   - Invia notifiche formattate su Telegram con dettagli sulla transazione, inclusi link a DexScreener, Photon e RugCheck

7. Gestione degli Errori e Riconnessione:
   - Implementa una logica di riconnessione in caso di errori di connessione WebSocket
   - Utilizza un sistema di retry con backoff esponenziale per le richieste HTTP fallite

8. Monitoraggio Multi-Wallet:
   - Utilizza una lista predefinita di indirizzi wallet da monitorare, invece di caricarli da un file JSON

9. Filtraggio delle Transazioni:
   - Ignora le transazioni per token creati più di 10 minuti fa
   - Evita l'elaborazione di transazioni duplicate

10. Loop Principale:
    - Gestisce la connessione WebSocket e l'elaborazione dei messaggi in un loop continuo
    - Implementa una logica di riavvio in caso di errori imprevisti

Differenze principali rispetto agli altri tracker:
1. Utilizza una lista hardcoded di wallet da monitorare invece di caricarli da un file JSON
2. Include codice commentato per una potenziale integrazione con Selenium per l'automazione del browser (attualmente non in uso)
3. Non include funzionalità specifiche per l'analisi di "vincitori" o "top trader"

Questo script è progettato per fornire un monitoraggio continuo e in tempo reale delle attività di trading su wallet Solana specifici, offrendo insights immediati attraverso notifiche Telegram dettagliate. È particolarmente utile per tracciare le attività di un gruppo predefinito di wallet, concentrandosi sui token di recente creazione.
"""

import asyncio
import json
import aiohttp
import websockets
from datetime import datetime, timezone, timedelta
from solana.rpc.async_api import AsyncClient
import solana.exceptions
from colorama import init, Fore, Style
import requests
import logging
import os
import aiofiles
import traceback
import time
#from selenium import webdriver
#from selenium.webdriver.common.by import By
#from selenium.webdriver.chrome.service import Service as ChromeService
#from webdriver_manager.chrome import ChromeDriverManager


#note:
#adesso quando arriva una transazione che non è uno swap, fa check tra i wallet e vede che non è di nessun wallet, quando
#invece è di uno dei wallet monitorati ma non è uno swap ma un transfer.

# Initialize a list to store the logs
log_data = []

# Get the absolute path of the directory where the script is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# Ensure the log directory exists
log_dir = os.path.join(script_dir, "my_app_logs")
os.makedirs(log_dir, exist_ok=True)

# Set up logging
log_file_path = os.path.join(log_dir, "app.log")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file_path),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Ensure the logs directory exists
os.makedirs('logs', exist_ok=True)
# Initialize colorama
init(autoreset=True)
# Inizializza un set per tenere traccia delle transazioni già elaborate
processed_signatures = set()

# Telegram bot token and chat ID
TELEGRAM_BOT_TOKEN = "7205146847:AAHBKcRVFrbCdacIMEwAKx7pMMb43ruojF0"
TELEGRAM_CHAT_ID = "256838561"

# Configure the Solana client to connect to the mainnet
solana_client = AsyncClient("https://api.mainnet-beta.solana.com", commitment="confirmed")

# async def write_logs_to_file():
#     while True:
#         async with aiofiles.open('logs/transactions_log.json', mode='w') as f:
#             await f.xwrite(json.dumps(log_data, indent=4))
#         await asyncio.sleep(60)  # Write to file every 60 seconds

async def fetch_transaction_details(signature, max_retries=5):
    url = "https://api.mainnet-beta.solana.com"
    headers = {"Content-Type": "application/json"}
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTransaction",
        "params": [str(signature), {"encoding": "json", "commitment": "confirmed", "maxSupportedTransactionVersion": 0}]
    }

    for attempt in range(max_retries):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=payload) as response:
                    if response.status == 200:
                        response_data = await response.json()
                        log_data.append({"type": "transaction_details", "data": response_data})
                        return response_data
                    elif response.status == 429:
                        print(f"{Fore.YELLOW}Rate limit exceeded for signature {signature} on attempt {attempt + 1}")
                    else:
                        print(f"{Fore.YELLOW}Failed to fetch transaction details for signature {signature} on attempt {attempt + 1}")
        except aiohttp.ClientConnectionError as e:
            print(f"{Fore.RED}HTTP connection error: {e}. Retrying in {2 ** attempt} seconds...")
        except Exception as e:
            print(f"{Fore.RED}Exception occurred while fetching transaction details for signature {signature}: {e}")
        await asyncio.sleep(2 ** attempt)  # Exponential backoff

    print(f"{Fore.RED}Max retries reached. Could not fetch transaction details for signature {signature}")
    return None

def calculate_buy_sell(pre_token_balances, post_token_balances, pre_balances, post_balances, token_address):
    token_delta = None
    sol_delta = (post_balances[0] - pre_balances[0]) / 1e9  # Convert lamports to SOL
    rounded_sol_delta = round(sol_delta, 1)

    for pre_balance, post_balance in zip(pre_token_balances, post_token_balances):
        if pre_balance["mint"] == token_address:
            pre_amount = int(pre_balance["uiTokenAmount"]["amount"])
            post_amount = int(post_balance["uiTokenAmount"]["amount"])
            token_delta = post_amount - pre_amount
            break

    if token_delta is not None:
        if token_delta < 0:
            return f"SELL: {abs(rounded_sol_delta)} SOL"
        elif sol_delta < 0:
            return f"BUY: {abs(rounded_sol_delta)} SOL"
        else:
            return "No significant transaction detected."
    else:
        return "Token address not found in balances."

async def fetch_token_details(token_address):
    url = f"https://api.dexscreener.com/latest/dex/tokens/{token_address}"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    token_details = await response.json()

                    # Comment out this line to stop dumping JSON data
                    #with open(f'{token_address}_dexscreener_response.json', 'w') as f:
                        #json.dump(token_details, f, indent=4)

                    return token_details
                else:
                    print(f"{Fore.YELLOW}Failed to fetch token details for address {token_address}")
                    return None
    except Exception as e:
        print(f"{Fore.RED}Exception occurred while fetching token details for address {token_address}: {e}")
        return None

# Function to handle button clicks
""" def button_click(update, context):
    query = update.callback_query
    query.answer()
    
    # Extract the action and token address from the callback data
    action, token_address, wallet = query.data.split('_')
    
    if action == "buy":
        # Construct the Jupiter URL
        jupiter_url = f"https://jup.ag/swap/SOL-{token_address}?inputAmount=0.05"
        
        # Open the Jupiter URL in Chrome using Selenium
        chrome_options = webdriver.ChromeOptions()
        chrome_options.add_argument("--start-maximized")

        # Create a new instance of the Chrome driver
        driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=chrome_options)
        
        # Go to the Jupiter URL
        driver.get(jupiter_url)

        # Add delay to let the page load (adjust the time as necessary)
        time.sleep(5)
        
        # Find the "Connect Wallet" button and click it (adjust the selector as necessary)
        connect_wallet_button = driver.find_element(By.XPATH, "//button[contains(text(), 'Connect Wallet')]")
        connect_wallet_button.click()

        # Add more delays and actions as necessary to complete the purchase
        # ...

        # Send a confirmation message to the user
        query.edit_message_text(text=f"Opening Jupiter for buying token {token_address} with 0.05 SOL.")

    elif action == "sell":
        # Placeholder for sell functionality
        query.edit_message_text(text="Sell functionality not implemented yet.")
 """
def send_telegram_message_with_buttons(message):
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    
    # Create InlineKeyboardButton for BUY and SELL
    #keyboard = [
        #[
            #InlineKeyboardButton("BUY", callback_data=f"buy_{token_address}_{wallet}"),
            #InlineKeyboardButton("SELL", callback_data=f"sell_{token_address}_{wallet}")
        #]
    #]
    #reply_markup = InlineKeyboardMarkup(keyboard)
    
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
        #"reply_markup": reply_markup.to_dict()
    }
    
    response = requests.post(url, json=payload)
    if response.status_code != 200:
        print(f"{Fore.RED}Failed to send message to Telegram: {response.text}")
    else:
        print(f"{Fore.GREEN}Message sent to Telegram successfully")

def calculate_age(creation_time):
    now = datetime.now(timezone.utc)
    age = now - datetime.fromtimestamp(creation_time, timezone.utc)
    return age.total_seconds()

# Modifica la funzione esistente analyze_transaction per includere la nuova funzione di invio messaggi con i tasti
async def analyze_transaction(transaction_details, wallet):
    tx_meta = transaction_details.get('result', {}).get('meta', {})
    pre_token_balances = tx_meta.get('preTokenBalances', [])
    post_token_balances = tx_meta.get('postTokenBalances', [])
    pre_balances = tx_meta.get('preBalances', [])
    post_balances = tx_meta.get('postBalances', [])

    if pre_token_balances and post_token_balances:
        for pre_balance, post_balance in zip(pre_token_balances, post_token_balances):
            if pre_balance.get('owner') == wallet:
                token_address = post_balance.get('mint')
                if token_address == "So11111111111111111111111111111111111111112":
                    continue  # Skip the specific token

                # Fetch token details from DexScreener
                token_details = await fetch_token_details(token_address)
                if token_details and 'pairs' in token_details and len(token_details['pairs']) > 0:
                    first_pair = next((pair for pair in token_details['pairs'] if pair.get('dexId') == 'raydium'), None)
                    if first_pair:
                        creation_time = first_pair.get('pairCreatedAt', 0) // 1000  # converting to seconds
                        age = calculate_age(creation_time)

                        # Check if the token was created more than 10 minutes ago
                        if (datetime.now(timezone.utc) - datetime.fromtimestamp(creation_time, timezone.utc)).total_seconds() > 600:
                            logger.info(f"Token {token_address} was created more than 10 minutes ago. Not sending to Telegram.")
                            print(f"Token {token_address} was created more than 10 minutes ago. Not sending to Telegram.")
                            return

                        ticker = first_pair['baseToken'].get('symbol', 'N/A')
                        timestamp = datetime.fromtimestamp(transaction_details['result']['blockTime'], timezone.utc).strftime('%d-%m-%Y %H:%M:%S UTC')

                        # Shorten the wallet address
                        short_wallet = f"{wallet[:5]}...{wallet[-4:]}"

                        # Create DexScreener link
                        dex_screener_link = f"https://dexscreener.com/solana/{token_address}"
                        dexscreener_link = f"https://dexscreener.com/solana/{token_address}?maker={wallet}"

                        # Create Photon and RugCheck links
                        photon_link = f"https://photon-sol.tinyastro.io/en/lp/{first_pair['pairAddress']}?handle=1791547328df5c98cbbb7"
                        rugcheck_link = f"https://rugcheck.xyz/tokens/{token_address}"

                        # Calculate Buy/Sell
                        buy_sell_message = calculate_buy_sell(pre_token_balances, post_token_balances, pre_balances, post_balances, token_address)

                        # Message format similar to the provided image
                        message = (
                            f"<b>Transaction Details</b>\n\n"
                            f"Wallet: <a href='{dexscreener_link}'>{short_wallet}</a>\n"
                            f"<b>CA:</b> <a href='{dex_screener_link}'>{token_address}</a>\n\n"
                            f"<b>Ticker:</b> <code>{ticker}</code>\n\n"
                            f"<b>Age:</b> <code>{age}</code>\n\n"
                            f"<b>{buy_sell_message}</b>\n"
                            f"<a href='{photon_link}'>PHT</a> | <a href='{rugcheck_link}'>RUG</a>"
                        )

                        send_telegram_message_with_buttons(message)
                    else:
                        print(f"{Fore.YELLOW}No pair found with dexId 'raydium' for address {token_address}")
                else:
                    print(f"{Fore.YELLOW}Token details not found for address {token_address}")
    else:
        error_message = f"No token balance found for transaction with signature {transaction_details['result']['transaction']['signatures'][0]}"
        print(f"{Fore.YELLOW}{error_message}")

async def handle_websocket_message(wallet_addresses, message):
    try:
        data = json.loads(message)

        if isinstance(data, dict) and 'method' in data and data['method'] == 'logsNotification':
            result = data.get('params', {}).get('result', {})
            if 'value' in result:
                signature = result['value']['signature']
                if signature in processed_signatures:
                    print(f"{Fore.YELLOW}Transaction with signature {signature} has already been processed. Skipping...")
                    return

                processed_signatures.add(signature)

                transaction_details = await fetch_transaction_details(signature)
                if transaction_details:
                    transaction_wallets = [pre_balance['owner'] for pre_balance in transaction_details['result']['meta']['preTokenBalances']]
                    for wallet_address in wallet_addresses:
                        if wallet_address in transaction_wallets:
                            print(f"Processing transaction for wallet: {wallet_address}, signature: {signature}")
                            await analyze_transaction(transaction_details, wallet_address)
                            break  # Exit the loop once the wallet is found and processed
                    # If no monitored wallet is found, simply continue without logging
        else:
            print(f"Unexpected data format in WebSocket message: {data}")
    except json.JSONDecodeError:
        print(f"{Fore.RED}Failed to decode JSON message: {message}")
    except AttributeError:
        print(f"{Fore.RED}Error handling WebSocket message: missing expected data")
    except Exception as e:
        print(f"{Fore.RED}Error handling WebSocket message: {e}")

async def periodic_log():
    while True:
        print("WebSocket connection is UP and running")
        await asyncio.sleep(60)

async def monitor_wallet_transactions(wallet_addresses):
    while True:
        try:
            async with websockets.connect("wss://api.mainnet-beta.solana.com/") as websocket:
                subscription_payloads = [
                    json.dumps({
                        "jsonrpc": "2.0",
                        "id": i + 1,
                        "method": "logsSubscribe",
                        "params": [
                            {"mentions": [wallet]},
                            {"commitment": "confirmed"}
                        ]
                    }) for i, wallet in enumerate(wallet_addresses)
                ]

                for payload in subscription_payloads:
                    await websocket.send(payload)

                asyncio.create_task(periodic_log())
                
                # Keep-alive ping
                async def keep_alive():
                    while True:
                        try:
                            await websocket.send(json.dumps({"jsonrpc": "2.0", "method": "ping"}))
                            await asyncio.sleep(30)  # Send a ping every 30 seconds
                        except websockets.ConnectionClosed:
                            break

                asyncio.create_task(keep_alive())

                while True:
                    try:
                        message = await websocket.recv()
                        await handle_websocket_message(wallet_addresses, message)
                    except websockets.ConnectionClosedError as e:
                        logging.error(f"WebSocket connection error: {e}. Reconnecting in 5 seconds...")
                        break  # Exit the loop to reconnect
        except (websockets.ConnectionClosedError, websockets.InvalidStatusCode) as e:
            logging.error(f"WebSocket connection error: {e}. Reconnecting in 5 seconds...")
            await asyncio.sleep(5)  # Wait before retrying
        except Exception as e:
            logging.error(f"Unexpected error: {e}. Reconnecting in 5 seconds...")
            await asyncio.sleep(5)  # Wait before retrying

async def main():
    try:
        # Wallets to monitor
        wallets = [
        "GgDGFZzrweSj3yRQUQnDpnmPFMP3zK54Pzogm4WF3GW1",
        "HYWo71Wk9PNDe5sBaRKazPnVyGnQDiwgXCFKvgAQ1ENp",
        "J88g6oqKPSEUyJTXb9hqPeB4kYaozYSyH2HYj2Ck8qxH",
        "55NQkFDwwW8noThkL9Rd5ngbgUU36fYZeos1k5ZwjGdn",
        "F68pTD9NPCiMTSy818GppeMMc14pfErsXxLgqptBMeme",
        "2nPDW4NRnKwYvWLcAVHYCzwkCJv5WHUn2Mm5H8CRsWXP",
        "FraVFHdQCsfvnvj4QnAiPCzhWCUSJvbSjoXTo6fKdAvK",
        "4bZjhBkuCoZTh8ov6NX7RtzyMEXZdMprY2WLodgwkdoq",
        "5iC1yoXYmUGsGBBLSKTgedya4cjQokaD3DxYoUTozz3c",
        "3bK4HCxLXduJEyMjgdoDqp7vsHpf9BR77Pyy5bLDvEE2",
        "FjmRj8y9xfDaj5Aygq88t5jAFbpxrbZ16JNPPG1sx9FQ",
        "HwRnKq7RPtKHvX9wyHsc1zvfHtGjPQa5tyZtGtbvfXE",
        "E8N4s2DDdC7jBxveFTrKVirM3tdw545NZ3myEdx9JVxB",
        "44hbXiWmkHPSQhXMPHuKDY1PwMVvhhRkYvjdZ5hwz58w"
               
    ]
        
        # Start the Telegram bot
        #updater = Updater(TELEGRAM_BOT_TOKEN, use_context=True)
        #dispatcher = updater.dispatcher
        #dispatcher.add_handler(CallbackQueryHandler(button_click))
        #updater.start_polling()

        while True:
            try:
                await monitor_wallet_transactions(wallets)
            except Exception as e:
                logging.error("An unexpected error occurred: %s", e)
                logging.error("Traceback: %s", traceback.format_exc())
    finally:
        input("Press Enter to exit...")

if __name__ == "__main__":
    asyncio.run(main())