const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const port = 5001;

app.use(cors());
app.use(express.json());

let lastRanking = null;
let lastUpdate = null;

const getRanking = (force = false) => {
  return new Promise((resolve, reject) => {
    // Se abbiamo già un ranking e non è richiesto un aggiornamento forzato
    if (lastRanking && !force) {
      return resolve({
        ranking: lastRanking,
        timestamp: lastUpdate
      });
    }

    const pythonProcess = spawn('python3', [path.join(__dirname, 'coinbaseScraper.py')]);
    let dataString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Error from Python script: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Python script exited with code ${code}`));
      }

      try {
        const ranking = parseInt(dataString.trim());
        if (isNaN(ranking)) {
          return reject(new Error('Invalid ranking value'));
        }

        lastRanking = ranking;
        lastUpdate = new Date().toISOString();

        resolve({
          ranking: lastRanking,
          timestamp: lastUpdate
        });
      } catch (error) {
        reject(error);
      }
    });
  });
};

app.get('/api/crypto/coinbase-ranking', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const data = await getRanking(force);
    res.json({ data });
  } catch (error) {
    console.error('Error getting Coinbase ranking:', error);
    res.status(500).json({ 
      error: 'Failed to get Coinbase ranking',
      message: error.message 
    });
  }
});

// Funzione per aggiornare il ranking periodicamente
const updateRankingPeriodically = async () => {
  try {
    console.log('Aggiornamento automatico del ranking...');
    const data = await getRanking(true); // force=true per forzare l'aggiornamento
    console.log('Ranking aggiornato:', data);
  } catch (error) {
    console.error('Errore nell\'aggiornamento automatico del ranking:', error);
  }
};

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  
  // Esegui subito il primo aggiornamento
  updateRankingPeriodically();
  
  // Imposta l'aggiornamento automatico ogni ora
  setInterval(updateRankingPeriodically, 60 * 60 * 1000); // 60 minuti * 60 secondi * 1000 millisecondi
});
