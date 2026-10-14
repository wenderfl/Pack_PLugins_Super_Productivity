// Lista de Compras Plugin for Super Productivity
(function () {
  'use strict';

  function openShoppingListView() {
    if (typeof PluginAPI !== 'undefined' && typeof PluginAPI.showIndexHtmlAsView === 'function') {
      PluginAPI.showIndexHtmlAsView();
    }
  }

  if (typeof PluginAPI !== 'undefined') {
    // Registra botão opcional no cabeçalho superior (header)
    if (typeof PluginAPI.registerHeaderButton === 'function') {
      try {
        PluginAPI.registerHeaderButton({
          label: 'Lista de Compras',
          icon: 'shopping_bag',
          onClick: openShoppingListView
        });
      } catch (e) {
        console.error('[Lista de Compras] Header button error:', e);
      }
    }
    // A entrada no menu lateral é criada automaticamente pelo Super Productivity
    // através de manifest.json ("isSkipMenuEntry": false e "icon": "icon.svg").
  }
})();
