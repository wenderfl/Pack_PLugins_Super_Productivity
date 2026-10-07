#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');

const { LetterboxdCache } = require('./src/cache');
const { DEFAULT_USERNAME } = require('./src/config');
const { scrapeRss, scrapeWatchlist, scrapeFilmsPage } = require('./src/scraper');
const { resolveTitleToEnglish, normalizeText } = require('./src/titleResolver');

// Cache instances per username
const cacheInstances = new Map();

function getCache(username = DEFAULT_USERNAME) {
  const user = username || DEFAULT_USERNAME;
  if (!cacheInstances.has(user)) {
    cacheInstances.set(user, new LetterboxdCache(user));
  }
  return cacheInstances.get(user);
}

const server = new Server(
  {
    name: 'letterboxd-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Define MCP tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_profile_summary',
        description: 'Retorna um resumo do perfil do usuário no Letterboxd, status do cache e últimas atividades.',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Nome de usuário no Letterboxd (padrão: wender_fl)'
            }
          }
        }
      },
      {
        name: 'get_recent_diary',
        description: 'Obtém em tempo real os filmes assistidos mais recentemente (feed RSS do Letterboxd) com notas, datas de visualização e links.',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Nome de usuário no Letterboxd (padrão: wender_fl)'
            },
            limit: {
              type: 'number',
              description: 'Quantidade máxima de filmes a retornar (padrão: 15)'
            }
          }
        }
      },
      {
        name: 'search_films',
        description: 'Pesquisa filmes no histórico assistido e/mode watchlist do usuário. Suporta títulos em português ou original em inglês (com resolução automática via Wikipedia).',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Nome ou palavra-chave do filme (ex: "O Poderoso Chefão", "The Godfather", "Duna")'
            },
            search_in: {
              type: 'string',
              enum: ['all', 'watched', 'watchlist'],
              description: 'Onde buscar: "all" (assistidos e watchlist), "watched" (apenas assistidos) ou "watchlist" (apenas watchlist). Padrão: "all"'
            },
            username: {
              type: 'string',
              description: 'Nome de usuário no Letterboxd (padrão: wender_fl)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'get_watchlist',
        description: 'Lista os filmes salvos na Watchlist (filmes para ver) do usuário no Letterboxd.',
        inputSchema: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              description: 'Nome de usuário no Letterboxd (padrão: wender_fl)'
            },
            limit: {
              type: 'number',
              description: 'Quantidade máxima de filmes da watchlist a retornar (padrão: 25)'
            },
            force_refresh: {
              type: 'boolean',
              description: 'Se true, faz nova raspagem ao vivo da watchlist ignorando cache local (padrão: false)'
            }
          }
        }
      },
      {
        name: 'check_film',
        description: 'Verifica diretamente se um filme específico já foi assistido pelo usuário (com nota e data) ou se está na watchlist.',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Título do filme em português ou inglês'
            },
            username: {
              type: 'string',
              description: 'Nome de usuário no Letterboxd (padrão: wender_fl)'
            }
          },
          required: ['title']
        }
      },
      {
        name: 'sync_cache',
        description: 'Atualiza o cache local com os dados mais recentes do Letterboxd. Modo "quick" sincroniza RSS + página 1 + watchlist; modo "full" faz varredura completa de todas as páginas.',
        inputSchema: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['quick', 'full'],
              description: 'Modo de sincronização: "quick" (rápido, últimos filmes + watchlist) ou "full" (todos os filmes cadastrados). Padrão: "quick"'
            },
            username: {
              type: 'string',
              description: 'Nome de usuário no Letterboxd (padrão: wender_fl)'
            }
          }
        }
      }
    ]
  };
});

// Helper matching logic
function filmMatches(film, queryNorm, enNorm) {
  const nameNorm = normalizeText(film.name || film.title || '');
  const slugNorm = normalizeText((film.slug || '').replace(/-/g, ' '));

  if (nameNorm.includes(queryNorm) || slugNorm.includes(queryNorm)) return true;
  if (enNorm && (nameNorm.includes(enNorm) || slugNorm.includes(enNorm))) return true;

  return false;
}

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const username = args.username || DEFAULT_USERNAME;
  const cache = getCache(username);

  try {
    switch (name) {
      case 'get_profile_summary': {
        const isStale = cache.isStale();
        const hasData = cache.hasData();
        const rss = await scrapeRss(username);

        const summary = {
          username,
          cache: {
            hasData,
            isStale,
            totalFilmsCached: cache.data.totalFilms || 0,
            watchlistCachedCount: (cache.data.watchlist || []).length,
            lastQuickSync: cache.data.lastQuickSync,
            lastFullSync: cache.data.lastFullSync
          },
          recentDiaryEntriesCount: rss.length,
          latestWatches: rss.slice(0, 5)
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summary, null, 2)
            }
          ]
        };
      }

      case 'get_recent_diary': {
        const limit = args.limit ? Math.min(Math.max(1, args.limit), 50) : 15;
        const rss = await scrapeRss(username);
        const entries = rss.slice(0, limit);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  username,
                  totalFound: entries.length,
                  entries
                },
                null,
                2
              )
            }
          ]
        };
      }

      case 'get_watchlist': {
        const limit = args.limit ? Math.min(Math.max(1, args.limit), 100) : 25;
        const forceRefresh = Boolean(args.force_refresh);

        let watchlist = cache.data.watchlist || [];
        if (forceRefresh || watchlist.length === 0) {
          console.error(`[letterboxd-mcp] Scraping live watchlist for ${username}...`);
          watchlist = await scrapeWatchlist(username, 3);
          cache.data.watchlist = watchlist;
          cache.saveToDisk();
        }

        const sliced = watchlist.slice(0, limit);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  username,
                  totalInWatchlist: watchlist.length,
                  displayed: sliced.length,
                  watchlist: sliced
                },
                null,
                2
              )
            }
          ]
        };
      }

      case 'search_films': {
        const query = (args.query || '').trim();
        if (!query) {
          throw new Error('Parâmetro "query" é obrigatório.');
        }

        // Auto initialize cache if empty
        if (!cache.hasData()) {
          console.error(`[letterboxd-mcp] Cache vazio, iniciando quickSync inicial para ${username}...`);
          await cache.quickSync((msg) => console.error(`[letterboxd-mcp] ${msg}`));
        }

        const searchIn = args.search_in || 'all';
        const queryNorm = normalizeText(query);
        const resolved = await resolveTitleToEnglish(query);
        const enNorm = resolved?.enTitle ? normalizeText(resolved.enTitle) : null;

        const results = {
          query,
          resolvedTranslation: resolved,
          watchedFilmsFound: [],
          watchlistFound: []
        };

        if (searchIn === 'all' || searchIn === 'watched') {
          const films = cache.data.films || [];
          results.watchedFilmsFound = films.filter((f) => filmMatches(f, queryNorm, enNorm));
        }

        if (searchIn === 'all' || searchIn === 'watchlist') {
          const watchlist = cache.data.watchlist || [];
          results.watchlistFound = watchlist.filter((f) => filmMatches(f, queryNorm, enNorm));
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }
          ]
        };
      }

      case 'check_film': {
        const title = (args.title || '').trim();
        if (!title) {
          throw new Error('Parâmetro "title" é obrigatório.');
        }

        if (!cache.hasData()) {
          console.error(`[letterboxd-mcp] Cache vazio, iniciando quickSync para ${username}...`);
          await cache.quickSync((msg) => console.error(`[letterboxd-mcp] ${msg}`));
        }

        const queryNorm = normalizeText(title);
        const resolved = await resolveTitleToEnglish(title);
        const enNorm = resolved?.enTitle ? normalizeText(resolved.enTitle) : null;

        const films = cache.data.films || [];
        const watchlist = cache.data.watchlist || [];

        const watchedMatch = films.find((f) => filmMatches(f, queryNorm, enNorm));
        const watchlistMatch = watchlist.find((f) => filmMatches(f, queryNorm, enNorm));

        const response = {
          searchedTitle: title,
          resolvedTranslation: resolved,
          watched: Boolean(watchedMatch),
          inWatchlist: Boolean(watchlistMatch),
          watchedDetails: watchedMatch || null,
          watchlistDetails: watchlistMatch || null
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2)
            }
          ]
        };
      }

      case 'sync_cache': {
        const mode = args.mode === 'full' ? 'full' : 'quick';
        console.error(`[letterboxd-mcp] Iniciando sincronização em modo ${mode} para ${username}...`);

        let resultData;
        if (mode === 'full') {
          resultData = await cache.fullSync((msg) => console.error(`[letterboxd-mcp] ${msg}`));
        } else {
          resultData = await cache.quickSync((msg) => console.error(`[letterboxd-mcp] ${msg}`));
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  mode,
                  username,
                  totalFilms: resultData.totalFilms,
                  watchlistCount: resultData.watchlist.length,
                  lastSync: mode === 'full' ? resultData.lastFullSync : resultData.lastQuickSync
                },
                null,
                2
              )
            }
          ]
        };
      }

      default:
        throw new Error(`Ferramenta desconhecida: "${name}"`);
    }
  } catch (error) {
    console.error(`[letterboxd-mcp] Erro executando ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error.message }, null, 2)
        }
      ],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[letterboxd-mcp] Servidor Letterboxd MCP iniciado e ouvindo via stdio.');
}

main().catch((err) => {
  console.error('[letterboxd-mcp] Falha fatal na inicialização:', err);
  process.exit(1);
});
