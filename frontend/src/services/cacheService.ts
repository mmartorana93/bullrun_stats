interface CacheData {
  data: any;
  timestamp: number;
}

interface CacheConfig {
  ttl: number;  // Time To Live in millisecondi
}

class CacheService {
  private static cache: { [key: string]: CacheData } = {};
  
  private static defaultConfig: CacheConfig = {
    ttl: 30000  // 30 secondi default
  };

  private static configs: { [key: string]: CacheConfig } = {
    'coinbase-ranking': { ttl: 24 * 60 * 60 * 1000 },  // 24 ore
    'market-data': { ttl: 60000 },                      // 1 minuto
    'bitcoin-dominance': { ttl: 60000 }                 // 1 minuto
  };

  static set(key: string, data: any): void {
    this.cache[key] = {
      data,
      timestamp: Date.now()
    };
  }

  static get(key: string): any | null {
    const cached = this.cache[key];
    if (!cached) return null;

    const config = this.configs[key] || this.defaultConfig;
    const now = Date.now();
    
    if (now - cached.timestamp > config.ttl) {
      delete this.cache[key];
      return null;
    }

    return cached.data;
  }

  static isExpired(key: string): boolean {
    const cached = this.cache[key];
    if (!cached) return true;

    const config = this.configs[key] || this.defaultConfig;
    return Date.now() - cached.timestamp > config.ttl;
  }
}

export default CacheService; 