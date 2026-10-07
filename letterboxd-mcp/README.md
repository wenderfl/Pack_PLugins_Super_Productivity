# Letterboxd MCP Server

Servidor MCP (Model Context Protocol) para integração com o Letterboxd do usuário (`wender_fl`).

## Ferramentas Disponíveis (Tools)

- **`get_profile_summary`**: Retorna resumo geral do perfil, status do cache e últimas atividades no Letterboxd.
- **`get_recent_diary`**: Busca em tempo real o histórico recente via feed RSS (filmes assistidos recentemente, notas dadas, datas e URLs).
- **`search_films`**: Pesquisa filmes no catálogo pessoal (filmes já vistos e/ou na watchlist). Suporta buscas em português e inglês com tradução e correspondência automática.
- **`get_watchlist`**: Retorna os filmes adicionados na Watchlist (filmes para assistir).
- **`check_film`**: Consulta pontual se um determinado filme já foi assistido, qual a nota dada, ou se está na watchlist.
- **`sync_cache`**: Sincroniza o cache local. Suporta os modos `quick` (últimos filmes + watchlist + RSS) e `full` (varredura completa).

## Como Executar

Diretamente via Node:
```bash
node index.js
```

Ou via script npm:
```bash
npm start
```

## Configuração MCP

Registrado no arquivo `mcp_config.json`:
```json
{
  "mcpServers": {
    "letterboxd": {
      "command": "/home/zorin/.local/bin/node",
      "args": ["/home/zorin/Music/letterboxd-mcp/index.js"]
    }
  }
}
```
