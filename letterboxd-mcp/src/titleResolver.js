/**
 * Resolves Portuguese or alternative movie titles to their original/English titles
 * using Wikipedia's language link API, plus normalization helpers.
 */

const titleTranslationCache = new Map();

function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics / accents
    .replace(/[:.,'"!?\-_/\\()]/g, ' ') // replace punctuation with spaces
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(text) {
  if (!text) return '';
  return normalizeText(text)
    .replace(/\s+/g, '-');
}

/**
 * Given a movie title (possibly in Portuguese, e.g. "O Poderoso Chefão" or "Divertida Mente"),
 * find the original/English title via Wikipedia if it exists.
 */
async function resolveTitleToEnglish(title) {
  if (!title) return null;
  const normalized = normalizeText(title);
  if (titleTranslationCache.has(normalized)) {
    return titleTranslationCache.get(normalized);
  }

  try {
    const searchUrl = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title + ' filme')}&format=json`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'LetterboxdMCP/1.0 (movie-search-helper)' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hit = data?.query?.search?.[0];
    if (!hit) return null;

    const pageTitle = hit.title;
    const langLinkUrl = `https://pt.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=en&titles=${encodeURIComponent(pageTitle)}&format=json`;
    const resLang = await fetch(langLinkUrl, {
      headers: { 'User-Agent': 'LetterboxdMCP/1.0 (movie-search-helper)' }
    });
    if (!resLang.ok) return null;
    const langData = await resLang.json();
    const pages = langData?.query?.pages || {};
    const page = Object.values(pages)[0];
    const enRaw = page?.langlinks?.[0]?.['*'];

    const cleanTitle = (raw) => {
      if (!raw) return null;
      return raw.replace(/\s*\(.*?\)\s*$/, '').trim();
    };

    const resolved = {
      ptTitle: cleanTitle(pageTitle),
      enTitle: cleanTitle(enRaw) || cleanTitle(pageTitle)
    };

    titleTranslationCache.set(normalized, resolved);
    return resolved;
  } catch (err) {
    // If Wikipedia fails or network times out, just return null gracefully
    return null;
  }
}

module.exports = {
  normalizeText,
  slugify,
  resolveTitleToEnglish
};
