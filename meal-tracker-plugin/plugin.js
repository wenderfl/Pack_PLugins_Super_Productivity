// Meal Tracker Plugin for Super Productivity
(function () {
  'use strict';

  if (typeof PluginAPI !== 'undefined' && typeof PluginAPI.registerHeaderButton === 'function') {
    try {
      PluginAPI.registerHeaderButton({
        label: 'Refeições',
        icon: 'restaurant',
        onClick: function () {
          if (typeof PluginAPI.showIndexHtmlAsView === 'function') {
            PluginAPI.showIndexHtmlAsView();
          }
        }
      });
    } catch (e) {
      console.error('[Meal Tracker]', e);
    }
  }
})();
