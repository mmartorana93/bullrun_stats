import { NextApiRequest, NextApiResponse } from 'next';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'coinbase_ranking.json');

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

function saveRanking(ranking: number) {
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

async function shouldUpdate(force = false) {
  if (force) {
    return true;
  }

  const storedData = getStoredData();
  if (!storedData) {
    return true;
  }

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const force = req.query.force === 'true';
    const storedData = getStoredData();

    if (await shouldUpdate(force)) {
      const ranking = await fetchRanking();
      saveRanking(ranking);
      console.log(ranking);
      return res.status(200).json(ranking);
    } else {
      console.log(storedData.ranking);
      return res.status(200).json(storedData.ranking);
    }
  } catch (e) {
    console.log("0");
    return res.status(200).json(0);
  }
} 