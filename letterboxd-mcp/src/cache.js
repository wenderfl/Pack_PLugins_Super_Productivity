const fs = require('fs');
const path = require('path');
const { CACHE_DIR, CACHE_FILE, DEFAULT_USERNAME } = require('./config');
const { scrapeAllFilms, scrapeFilmsPage, scrapeWatchlist, scrapeRss } = require('./scraper');

class LetterboxdCache {
  constructor(username = DEFAULT_USERNAME) {
    this.username = username;
    this.data = {
      username: this.username,
      lastFullSync: null,
      lastQuickSync: null,
      totalFilms: 0,
      films: [],
      watchlist: []
    };
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.films)) {
          this.data = parsed;
        }
      }
    } catch (err) {
      console.error('Failed to read cache file:', err.message);
    }
  }

  saveToDisk() {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write cache file:', err.message);
    }
  }

  hasData() {
    return this.data.films && this.data.films.length > 0;
  }

  isStale(maxAgeHours = 12) {
    if (!this.data.lastQuickSync && !this.data.lastFullSync) return true;
    const lastSyncTime = new Date(this.data.lastQuickSync || this.data.lastFullSync).getTime();
    const ageHours = (Date.now() - lastSyncTime) / (1000 * 60 * 60);
    return ageHours > maxAgeHours;
  }

  async quickSync(onProgress = null) {
    if (onProgress) onProgress('Starting quick sync (page 1 + watchlist + RSS)...');
    
    // Scrape RSS
    const rssItems = await scrapeRss(this.username);
    const rssMap = new Map();
    for (const r of rssItems) {
      if (r.slug) rssMap.set(r.slug, r);
    }

    // Scrape page 1
    const { items: page1Items } = await scrapeFilmsPage(this.username, 1);
    
    // Merge page 1 items into existing films
    const existingMap = new Map();
    for (const f of this.data.films) {
      existingMap.set(f.slug, f);
    }

    for (const f of page1Items) {
      const rss = rssMap.get(f.slug);
      if (rss && rss.watchedDate) {
        f.watchedDate = rss.watchedDate;
      }
      existingMap.set(f.slug, f);
    }

    // Convert back to array (preserve order of page 1 first)
    const updatedFilms = [...page1Items];
    for (const f of this.data.films) {
      if (!page1Items.some(p => p.slug === f.slug)) {
        updatedFilms.push(f);
      }
    }

    // Scrape watchlist (typically 1-2 pages)
    const watchlist = await scrapeWatchlist(this.username, 3);

    this.data.films = updatedFilms;
    this.data.totalFilms = updatedFilms.length;
    this.data.watchlist = watchlist;
    this.data.lastQuickSync = new Date().toISOString();
    this.saveToDisk();

    if (onProgress) onProgress(`Quick sync complete! Total films: ${this.data.totalFilms}, Watchlist: ${this.data.watchlist.length}`);
    return this.data;
  }

  async fullSync(onProgress = null) {
    if (onProgress) onProgress('Starting full sync of all films and watchlist...');
    
    const films = await scrapeAllFilms(this.username, null, (prog) => {
      if (onProgress) {
        onProgress(`Scraping page ${prog.page} (scraped ${prog.currentCount} films)...`);
      }
    });

    if (onProgress) onProgress('Scraping watchlist...');
    const watchlist = await scrapeWatchlist(this.username, 10);

    this.data.films = films;
    this.data.totalFilms = films.length;
    this.data.watchlist = watchlist;
    this.data.lastFullSync = new Date().toISOString();
    this.data.lastQuickSync = new Date().toISOString();
    this.saveToDisk();

    if (onProgress) onProgress(`Full sync complete! Total films: ${this.data.totalFilms}, Watchlist: ${this.data.watchlist.length}`);
    return this.data;
  }
}

module.exports = {
  LetterboxdCache
};
