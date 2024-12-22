import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';

const api = axios.create({
    baseURL: BACKEND_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 15000
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.code === 'ECONNABORTED') {
            console.error('Timeout della richiesta API');
        } else if (error.response) {
            console.error('Errore API:', {
                status: error.response.status,
                data: error.response.data
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
