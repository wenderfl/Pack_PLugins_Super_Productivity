#!/usr/bin/env python3
"""
Build script to compile index.src.html into index.html for Super Productivity.
Strict limit: <= 102,400 bytes (100 KB).
"""
import os
import re
import json
import subprocess
import sys

DIR = os.path.dirname(os.path.abspath(__file__))
PROTO_DIR = os.path.abspath(os.path.join(DIR, '..', 'prototipo-lista-compras'))
INDEX_SRC_PATH = os.path.join(DIR, 'index.src.html')
INDEX_OUT_PATH = os.path.join(DIR, 'index.html')

def build():
    print("Iniciando build do plugin Super Productivity Lista de Compras...")

    # 1. Carrega products-data.js e empacota com decodificador ultra-compacto
    products_file = os.path.join(PROTO_DIR, 'products-data.js')
    with open(products_file, 'r', encoding='utf-8') as f:
        prod_content = f.read()

    p_data = json.loads(re.search(r'\[.*\]', prod_content, re.DOTALL).group(0))
    cats = sorted(list(set(p['categoria'] for p in p_data)))
    units = sorted(list(set(p['unidade'] for p in p_data)))

    items = []
    for p in p_data:
        c = cats.index(p['categoria'])
        u = units.index(p['unidade'])
        arq = p.get('arquivo', '')
        expected = p['nome'] + '.webp'
        if arq == expected:
            items.append(f"{p['id']}|{p['nome']}|{c}|{u}")
        else:
            items.append(f"{p['id']}|{p['nome']}|{c}|{u}|{arq}")

    str_data = ";".join(items)
    cats_str = ";".join(cats)
    units_str = ";".join(units)

    js_decoder = (
        f'const _C="{cats_str}".split(";"),_U="{units_str}".split(";");'
        f'window.PRODUCTS_DATA="{str_data}".split(";").map(s=>{{'
        f'const a=s.split("|");'
        f'const arq=a[4]||a[1]+".webp";'
        f'return{{id:a[0],nome:a[1],categoria:_C[+a[2]],unidade:_U[+a[3]],'
        f'arquivo:arq,get icone(){{return getIconUrl(this);}}}};'
        f'}});'
    )

    # 2. Carrega styles.css e substitui variáveis repetitivas antes da minificação
    styles_file = os.path.join(PROTO_DIR, 'styles.css')
    with open(styles_file, 'r', encoding='utf-8') as f:
        raw_css = f.read()

    css_subs = [
        ("var(--sp-white)", "#fff"),
        ("var(--sp-black)", "#000"),
        ("var(--sp-dark)", "#121212"),
        ("var(--sp-elevated)", "#181818"),
        ("var(--sp-green)", "#1ed760"),
        ("var(--sp-green-hover)", "#1fdf64"),
        ("var(--sp-green-active)", "#169c46"),
        ("var(--sp-card)", "#181818"),
        ("var(--sp-card-hover)", "#282828"),
        ("var(--sp-subtext)", "#b3b3b3"),
        ("var(--sp-muted)", "#727272"),
        ("var(--sp-danger)", "#e22134"),
        ("var(--sp-warning)", "#ffa42b"),
        ("var(--sp-blue)", "#2e77d0"),
        ("var(--sp-border)", "rgba(255,255,255,.08)"),
        ("var(--sp-border-hover)", "rgba(255,255,255,.15)"),
        ("var(--sp-highlight)", "#2a2a2a"),
        ("var(--sp-green-glow)", "rgba(30,215,96,.3)"),
        ("var(--radius-full)", "999px"),
        ("var(--radius-md)", "12px"),
        ("var(--radius-sm)", "8px"),
        ("var(--radius-xs)", "4px"),
        ("var(--font-family)", "system-ui,sans-serif"),
        ("var(--transition)", "all .2s ease")
    ]
    opt_css = raw_css
    for o, n in css_subs:
        opt_css = opt_css.replace(o, n)
    opt_css = re.sub(r':root\s*\{[^}]*\}', '', opt_css)

    p_css = subprocess.run(
        ["npx", "clean-css-cli", "-O2"],
        input=opt_css.encode("utf-8"),
        stdout=subprocess.PIPE,
        check=True
    )
    try:
        p_csso = subprocess.run(
            ["npx", "csso-cli"],
            input=p_css.stdout,
            stdout=subprocess.PIPE,
            check=True
        )
        min_css = p_csso.stdout.decode("utf-8")
    except Exception:
        min_css = p_css.stdout.decode("utf-8")
    print(f"CSS Minificado: {len(min_css.encode('utf-8'))} bytes")

    # 3. Carrega app.js e anexa helpers do PluginAPI do Super Productivity
    app_file = os.path.join(PROTO_DIR, 'app.js')
    with open(app_file, 'r', encoding='utf-8') as f:
        raw_js = f.read()

    sp_helpers = """
function getSP() {
  if (typeof PluginAPI !== "undefined" && PluginAPI) return PluginAPI;
  if (typeof window.PluginAPI !== "undefined" && window.PluginAPI) return window.PluginAPI;
  if (typeof window.superProductivity !== "undefined" && window.superProductivity) return window.superProductivity;
  try {
    if (window.parent && typeof window.parent.PluginAPI !== "undefined" && window.parent.PluginAPI) return window.parent.PluginAPI;
  } catch (e) {}
  return null;
}

let isSPInitialized = false;
let isSyncingIncoming = false;
let syncDebounceTimer = null;
let hooksInitialized = false;

async function syncToSuperProductivity() {
  if (!isSPInitialized || isSyncingIncoming) return;
  clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(async () => {
    const sp = getSP();
    if (sp && typeof sp.persistDataSynced === "function") {
      const payload = JSON.stringify({
        shoppingList: state.shoppingList,
        pantryList: state.pantryList,
        aiChatHistory: state.aiChatHistory,
        updatedAt: Date.now()
      });
      try {
        await sp.persistDataSynced(payload, "listouShoppingData");
      } catch (e) {
        try { await sp.persistDataSynced(payload); } catch (err) {}
      }
    }
  }, 300);
}

async function loadFromSuperProductivity() {
  const sp = getSP();
  if (sp && typeof sp.loadSyncedData === "function") {
    try {
      let res = await sp.loadSyncedData("listouShoppingData");
      if (!res) res = await sp.loadSyncedData();
      if (res) {
        const p = typeof res === "string" ? JSON.parse(res) : res;
        if (p && typeof p === "object") {
          isSyncingIncoming = true;
          let changed = false;
          if (Array.isArray(p.shoppingList)) {
            state.shoppingList = p.shoppingList.map(item => {
              if (item) item.icone = getIconUrl(item);
              return item;
            });
            localStorage.setItem("listou_spotify_shopping_list", JSON.stringify(state.shoppingList));
            changed = true;
          }
          if (Array.isArray(p.pantryList)) {
            state.pantryList = p.pantryList.map(item => {
              if (item) item.icone = getIconUrl(item);
              return item;
            });
            localStorage.setItem("listou_spotify_pantry", JSON.stringify(state.pantryList));
            changed = true;
          }
          if (Array.isArray(p.aiChatHistory)) {
            state.aiChatHistory = p.aiChatHistory;
            localStorage.setItem("listou_spotify_ai_chat_history", JSON.stringify(state.aiChatHistory));
            changed = true;
          }
          if (changed) {
            renderShoppingList();
            renderPantryList();
            renderMarketMode();
            renderCatalog();
            renderAiChatHistory();
            updateMetrics();
          }
          setTimeout(() => {
            isSyncingIncoming = false;
            isSPInitialized = true;
          }, 150);
          return;
        }
      } else {
        isSPInitialized = true;
        if ((state.shoppingList && state.shoppingList.length > 0) || (state.pantryList && state.pantryList.length > 0)) {
          syncToSuperProductivity();
        }
        return;
      }
    } catch (e) {
      isSyncingIncoming = false;
    }
  }
  isSPInitialized = true;
}

function initSuperProductivityHooks() {
  const sp = getSP();
  if (sp && typeof sp.registerHook === "function") {
    try {
      sp.registerHook("persistedDataChanged", () => {
        loadFromSuperProductivity();
      });
    } catch (e) {}
  }
  if (!hooksInitialized) {
    hooksInitialized = true;
    window.addEventListener("visibilitychange", () => {
      if (!document.hidden) loadFromSuperProductivity();
    });
    window.addEventListener("focus", () => {
      loadFromSuperProductivity();
    });
  }
  if (!sp) {
    setTimeout(() => {
      if (getSP()) {
        initSuperProductivityHooks();
        loadFromSuperProductivity();
      }
    }, 250);
    setTimeout(() => {
      if (getSP()) {
        initSuperProductivityHooks();
        loadFromSuperProductivity();
      }
    }, 800);
  }
}
"""

    js_code = raw_js
    js_code = js_code.replace("function saveShoppingList() {", "function saveShoppingList() {\n  syncToSuperProductivity();")
    js_code = js_code.replace("function savePantryList() {", "function savePantryList() {\n  syncToSuperProductivity();")
    js_code = js_code.replace("function saveAiChatHistory() {", "function saveAiChatHistory() {\n  syncToSuperProductivity();")
    js_code = js_code.replace("loadSavedShoppingList();", "loadSavedShoppingList();\n  loadFromSuperProductivity();\n  initSuperProductivityHooks();")

    combined_js = js_decoder + "\n" + sp_helpers + "\n" + js_code

    p_js = subprocess.run([
        "npx", "terser",
        "--compress", "passes=5,unsafe_arrows=true,unsafe_methods=true,dead_code=true,drop_console=true,drop_debugger=true,pure_getters=true,unsafe=true,unsafe_proto=true,unsafe_math=true,booleans_as_integers=true",
        "--mangle", "toplevel=true"
    ], input=combined_js.encode("utf-8"), stdout=subprocess.PIPE, check=True)
    min_js = p_js.stdout.decode("utf-8")
    print(f"JS Minificado: {len(min_js.encode('utf-8'))} bytes")

    # 4. Carrega index.html e cria index.src.html e index.html compilado
    index_html_file = os.path.join(PROTO_DIR, 'index.html')
    with open(index_html_file, 'r', encoding='utf-8') as f:
        raw_html = f.read()

    # Salva index.src.html para edição e inspeção
    src_html = raw_html.replace(
        '<link rel="stylesheet" href="styles.css">',
        f'<style>{raw_css}</style>'
    ).replace(
        '<script src="products-data.js"></script>\n  <script src="app.js"></script>',
        f'<script>{combined_js}</script>'
    )
    with open(INDEX_SRC_PATH, 'w', encoding='utf-8') as f:
        f.write(src_html)
    print(f"index.src.html gravado com sucesso ({len(src_html.encode('utf-8'))} bytes)")

    clean_html = re.sub(r'<link rel="stylesheet".*?>', '', raw_html)
    clean_html = re.sub(r'<link rel="preconnect".*?>', '', clean_html)
    clean_html = re.sub(r'<link href="https://fonts\.googleapis\.com.*?>', '', clean_html)
    clean_html = re.sub(r'<script.*?</script>', '', clean_html, flags=re.DOTALL)
    clean_html = re.sub(r'<!--.*?-->', '', clean_html, flags=re.DOTALL)
    clean_html = re.sub(r'>\s+<', '><', clean_html)
    clean_html = re.sub(r'\s{2,}', ' ', clean_html).strip()

    try:
        p_htm = subprocess.run([
            "npx", "html-minifier-terser",
            "--collapse-whitespace",
            "--remove-comments",
            "--remove-redundant-attributes",
            "--remove-empty-attributes",
            "--remove-attribute-quotes",
            "--collapse-boolean-attributes"
        ], input=clean_html.encode("utf-8"), stdout=subprocess.PIPE, check=True)
        clean_html = p_htm.stdout.decode("utf-8")
    except Exception:
        pass

    final_html = clean_html.replace('</head>', f'<style>{min_css}</style></head>').replace('</body>', f'<script>{min_js}</script></body>')
    final_bytes = len(final_html.encode('utf-8'))
    print(f"index.html final: {final_bytes} bytes (Limite: 102.400 bytes | Margem livre: {102400 - final_bytes} bytes)")

    with open(INDEX_OUT_PATH, 'w', encoding='utf-8') as f:
        f.write(final_html)

    if final_bytes <= 102400:
        print(f"SUCESSO ABSOLUTO: index.html ({final_bytes} bytes) cumpre estritamente o requerimento de 100 KB do Super Productivity!")
    else:
        raise ValueError(f"Tamanho {final_bytes} excedeu o limite!")

    # 5. Gera automaticamente o pacote zip único oficial
    zip_dest = os.path.join(os.path.dirname(DIR), 'plugin_lista_de_compras.zip')
    print(f"Gerando pacote zip único oficial: {zip_dest}...")
    subprocess.run([
        'zip', '-q', '-9', '-r', zip_dest,
        'manifest.json', 'index.html', 'plugin.js', 'icon.svg', 'icones/'
    ], cwd=DIR, check=True)
    zip_size_mb = os.path.getsize(zip_dest) / (1024 * 1024)
    print(f"Pacote único gerado com sucesso: {zip_dest} ({zip_size_mb:.2f} MB)")

if __name__ == '__main__':
    manifest_path = os.path.join(DIR, 'manifest.json')
    if '--bump' in sys.argv:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        parts = manifest.get('version', '1.0.0').split('.')
        parts[-1] = str(int(parts[-1]) + 1)
        manifest['version'] = '.'.join(parts)
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
            f.write('\n')
        print(f"Versao incrementada no manifest.json para: {manifest['version']}")
    build()
