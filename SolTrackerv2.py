import requests
import time
import json
from datetime import datetime

class SolanaWalletTracker:
    def __init__(self, wallet_address):
        self.wallet = wallet_address
        self.endpoint = "https://api.mainnet-beta.solana.com"
        self.last_signature = None
        self.headers = {
            "Content-Type": "application/json"
        }

    def _make_rpc_call(self, method, params):
        try:
            payload = {
                "jsonrpc": "2.0",
                "id": 1,
                "method": method,
                "params": params
            }
            response = requests.post(self.endpoint, headers=self.headers, json=payload)
            return response.json()
        except Exception as e:
            print(f"Errore nella chiamata RPC: {e}")
            return None

    def get_transactions(self):
        try:
            params = [
                self.wallet,
                {
                    "limit": 10
                }
            ]
            result = self._make_rpc_call("getSignaturesForAddress", params)
            return result.get('result', []) if result else []
        except Exception as e:
            print(f"Errore nel recupero transazioni: {e}")
            return []

    def analyze_transaction(self, signature):
        try:
            params = [
                signature,
                {
                    "encoding": "json",
                    "maxSupportedTransactionVersion": 0
                }
            ]
            tx = self._make_rpc_call("getTransaction", params)
            if not tx or 'result' not in tx:
                return None

            tx = tx['result']
            
            # Analisi base della transazione
            timestamp = datetime.fromtimestamp(tx['blockTime'])
            amount = tx['meta']['postBalances'][0] - tx['meta']['preBalances'][0]
            amount_sol = abs(amount) / 1000000000  # Converti in SOL
            
            return {
                'timestamp': timestamp,
                'amount_sol': amount_sol,
                'success': tx['meta']['status'].get('Ok') is not None,
                'type': 'receive' if amount > 0 else 'send'
            }
        except Exception as e:
            print(f"Errore nell'analisi della transazione: {e}")
            return None

    def monitor(self):
        print(f"Monitoraggio wallet: {self.wallet}")
        
        while True:
            transactions = self.get_transactions()
            
            if transactions:
                latest_sig = transactions[0]['signature']
                
                if latest_sig != self.last_signature:
                    tx_data = self.analyze_transaction(latest_sig)
                    if tx_data:
                        print(f"""
Nuova transazione:
Timestamp: {tx_data['timestamp']}
Tipo: {tx_data['type']}
Importo: {tx_data['amount_sol']} SOL
Status: {'Successo' if tx_data['success'] else 'Fallita'}
""")
                    self.last_signature = latest_sig
            
            time.sleep(2)  # Pausa di 2 secondi tra i check

if __name__ == "__main__":
    wallet = input("Inserisci l'indirizzo del wallet Solana da monitorare: ")
    tracker = SolanaWalletTracker(wallet)
    tracker.monitor()
