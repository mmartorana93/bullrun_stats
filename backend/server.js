const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 5001;

app.use(cors());
app.use(express.json());

const CACHE_FILE = path.join(__dirname, 'coinbase_ranking.json');

function getStoredData() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      return data;
    }
    return null;
  } catch (e) {
    console.log(`Errore nella lettura del file: ${e}`);
    return null;
  }
}

function saveRanking(ranking) {
  const data = {
    ranking: ranking,
    timestamp: new Date().toISOString()
  };
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data));
  } catch (e) {
    console.log(`Errore nel salvataggio del file: ${e}`);
  }
}

function shouldUpdate(force = false) {
  if (force) return true;

  const storedData = getStoredData();
  if (!storedData) return true;

  const lastUpdate = new Date(storedData.timestamp);
  const hoursSinceUpdate = (new Date().getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate > 24;
}

async function fetchRanking() {
  try {
    const url = "https://apps.apple.com/it/app/coinbase-compra-btc-e-cripto/id886427730";
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const text = $.text();
    const match = text.match(/#(\d+)\s+in\s+Finanza/);

    if (match) {
      return parseInt(match[1]);
    }
    return 0;
  } catch (e) {
    console.log(`Errore nello scraping: ${e}`);
    return 0;
  }
}

app.get('/api/crypto/coinbase-ranking', async (req, res) => {
  try {
    console.log("Endpoint chiamato");
    const force = req.query.force === 'true';
    console.log("Force update:", force);
    const storedData = getStoredData();
    console.log("Stored data:", storedData);

    if (shouldUpdate(force)) {
      console.log("Fetching new ranking...");
      const ranking = await fetchRanking();
      console.log("New ranking fetched:", ranking);
      saveRanking(ranking);
      console.log("Ranking saved");
      res.json({ 
        data: {
          ranking, 
          timestamp: new Date().toISOString() 
        }
      });
    } else {
      console.log("Using stored ranking:", storedData.ranking);
      res.json({ 
        data: {
          ranking: storedData.ranking, 
          timestamp: storedData.timestamp 
        }
      });
    }
  } catch (e) {
    console.log("Error occurred:", e);
    res.json({ 
      data: {
        ranking: 0, 
        timestamp: new Date().toISOString() 
      }
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
