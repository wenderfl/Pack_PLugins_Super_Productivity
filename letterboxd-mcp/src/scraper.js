const cheerio = require('cheerio');
const { HEADERS } = require('./config');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseRatingFromClass(classNames) {
  if (!classNames) return { rating: null, stars: null };
  const classes = Array.isArray(classNames) ? classNames : classNames.split(/\s+/);
  for (const c of classes) {
    if (c.startsWith('rated-')) {
      const num = parseInt(c.replace('rated-', ''), 10);
      if (!isNaN(num)) {
        const rating = num / 2.0;
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 !== 0;
        let stars = '★'.repeat(fullStars) + (halfStar ? '½' : '');
        return { rating, stars };
      }
    }
  }
  return { rating: null, stars: null };
}

async function scrapeRss(username) {
  try {
    const url = `https://letterboxd.com/${username}/rss/`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const items = [];

    $('item').each((_, el) => {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const watchedDate = $(el).find('letterboxd\\:watchedDate').text().trim() || null;
      const rating = $(el).find('letterboxd\\:memberRating').text().trim() || null;
      const filmTitle = $(el).find('letterboxd\\:filmTitle').text().trim() || null;
      const filmYearStr = $(el).find('letterboxd\\:filmYear').text().trim() || null;
      const filmYear = filmYearStr ? parseInt(filmYearStr, 10) : null;

      // Extract slug from link
      // e.g. https://letterboxd.com/wender_fl/film/spider-man-brand-new-day/
      const match = link.match(/\/film\/([^/]+)\/?/);
      const slug = match ? match[1] : null;

      items.push({
        slug,
        title: filmTitle || title,
        year: filmYear,
        watchedDate,
        rating: rating ? parseFloat(rating) : null,
        link
      });
    });

    return items;
  } catch (err) {
    console.error('Error fetching RSS:', err.message);
    return [];
  }
}

async function scrapeFilmsPage(username, pageNumber) {
  const url = pageNumber > 1
    ? `https://letterboxd.com/${username}/films/page/${pageNumber}/`
    : `https://letterboxd.com/${username}/films/`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    if (res.status === 404) return { items: [], hasNextPage: false };
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const items = [];

  $('li.griditem').each((_, el) => {
    const item = $(el);
    const reactDiv = item.find('div.react-component');
    if (!reactDiv.length) return;

    const slug = reactDiv.attr('data-item-slug');
    const rawName = reactDiv.attr('data-item-name') || '';
    const link = reactDiv.attr('data-item-link') || `/film/${slug}/`;
    const fullDisplayName = reactDiv.attr('data-item-full-display-name') || rawName;

    // Extract year from "Film Name (YYYY)"
    const yearMatch = fullDisplayName.match(/\((\d{4})\)$/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
    const name = yearMatch ? fullDisplayName.replace(/\s*\(\d{4}\)$/, '').trim() : fullDisplayName;

    const ratingSpan = item.find('span.rating');
    const { rating, stars } = parseRatingFromClass(ratingSpan.attr('class'));

    const liked = item.find('span.like').length > 0;
    const reviewLink = item.find('a.review-micro').attr('href');
    const hasReview = Boolean(reviewLink);

    items.push({
      slug,
      name,
      fullDisplayName,
      year,
      rating,
      ratingStars: stars,
      liked,
      hasReview,
      reviewUrl: reviewLink ? `https://letterboxd.com${reviewLink}` : null,
      letterboxdUrl: `https://letterboxd.com${link}`
    });
  });

  const nextLink = $(`a[href*="/films/page/${pageNumber + 1}/"]`);
  const hasNextPage = nextLink.length > 0;

  return { items, hasNextPage };
}

async function scrapeAllFilms(username, maxPages = null, onProgress = null) {
  let page = 1;
  const allFilms = [];
  const rssItems = await scrapeRss(username);
  const rssMap = new Map();
  for (const r of rssItems) {
    if (r.slug) rssMap.set(r.slug, r);
  }

  while (true) {
    if (maxPages && page > maxPages) break;
    const { items, hasNextPage } = await scrapeFilmsPage(username, page);
    if (!items.length) break;

    for (const film of items) {
      const rss = rssMap.get(film.slug);
      if (rss && rss.watchedDate) {
        film.watchedDate = rss.watchedDate;
      }
      allFilms.push(film);
    }

    if (onProgress) {
      onProgress({ page, currentCount: allFilms.length, hasNextPage });
    }

    if (!hasNextPage) break;
    page++;
    await sleep(350); // Be respectful to the server
  }

  return allFilms;
}

async function scrapeWatchlist(username, maxPages = 5) {
  let page = 1;
  const watchlist = [];

  while (true) {
    if (page > maxPages) break;
    const url = page > 1
      ? `https://letterboxd.com/${username}/watchlist/page/${page}/`
      : `https://letterboxd.com/${username}/watchlist/`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) break;

    const html = await res.text();
    const $ = cheerio.load(html);
    const pageItems = [];

    $('li.griditem, li.poster-container').each((_, el) => {
      const item = $(el);
      const reactDiv = item.find('div.react-component');
      const slug = reactDiv.attr('data-item-slug') || item.find('div[data-film-slug]').attr('data-film-slug');
      const rawName = reactDiv.attr('data-item-name') || item.find('img').attr('alt') || slug;
      const link = reactDiv.attr('data-item-link') || `/film/${slug}/`;

      if (slug) {
        const yearMatch = rawName.match(/\((\d{4})\)$/);
        const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
        const name = yearMatch ? rawName.replace(/\s*\(\d{4}\)$/, '').trim() : rawName;

        pageItems.push({
          slug,
          name,
          year,
          letterboxdUrl: `https://letterboxd.com${link}`
        });
      }
    });

    if (!pageItems.length) break;
    watchlist.push(...pageItems);

    const nextLink = $(`a[href*="/watchlist/page/${page + 1}/"]`);
    if (!nextLink.length) break;
    page++;
    await sleep(300);
  }

  return watchlist;
}

module.exports = {
  scrapeRss,
  scrapeFilmsPage,
  scrapeAllFilms,
  scrapeWatchlist
};
