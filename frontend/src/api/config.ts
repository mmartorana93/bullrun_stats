import axios from 'axios';

const BACKEND_PORT = 5001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

const api = axios.create({
    baseURL: BACKEND_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    // Timeout di default a 15 secondi
    timeout: 15000
});

// Configurazione specifica per l'endpoint coinbase-ranking
export const getCoinbaseRanking = () => {
    return api.get('/api/coinbase-ranking', {
        timeout: 30000 // 30 secondi di timeout per questo endpoint specifico
    });
};

// Interceptor per loggare gli errori
api.interceptors.response.use(
    response => response,
    error => {
        if (error.code === 'ECONNABORTED') {
            console.error('Timeout della richiesta API');
        } else if (error.response) {
            console.error('Errore API:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            });
        } else if (error.request) {
            console.error('Nessuna risposta ricevuta:', error.request);
        } else {
            console.error('Errore di configurazione della richiesta:', error.message);
        }
        return Promise.reject(error);
    }
);

export default api;
