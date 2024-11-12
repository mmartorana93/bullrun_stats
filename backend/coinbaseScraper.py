import requests
from bs4 import BeautifulSoup
import re
import json
import os
from datetime import datetime, timedelta

def get_stored_data():
    try:
        if os.path.exists('coinbase_ranking.json'):
            with open('coinbase_ranking.json', 'r') as f:
                data = json.load(f)
                return data
        return None
    except Exception as e:
        print(f"Errore nella lettura del file: {e}")
        return None

def save_ranking(ranking):
    data = {
        'ranking': ranking,
        'timestamp': datetime.now().isoformat()
    }
    try:
        with open('coinbase_ranking.json', 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f"Errore nel salvataggio del file: {e}")

def should_update():
    stored_data = get_stored_data()
    if not stored_data:
        return True
    
    last_update = datetime.fromisoformat(stored_data['timestamp'])
    return datetime.now() - last_update > timedelta(hours=24)

def fetch_ranking():
    try:
        url = "https://apps.apple.com/it/app/coinbase-compra-btc-e-cripto/id886427730"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        text = soup.get_text()
        match = re.search(r'#(\d+)\s+in\s+Finanza', text)
        
        if match:
            return int(match.group(1))
        return 0
            
    except Exception as e:
        print(f"Errore nello scraping: {e}")
        return 0

def get_app_ranking():
    try:
        stored_data = get_stored_data()
        
        if should_update():
            ranking = fetch_ranking()
            save_ranking(ranking)
            print(ranking)
        else:
            print(stored_data['ranking'])
            
    except Exception as e:
        print("0")

if __name__ == "__main__":
    get_app_ranking()
