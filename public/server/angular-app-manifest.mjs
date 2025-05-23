
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: undefined,
  entryPointToBrowserMapping: {},
  assets: {
    'index.csr.html': {size: 5281, hash: '776cc1a4eddb0c70c8f6ebf68deb6daede8fbfd317788a47941196eb87a04316', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 5544, hash: '19b91d39ef64f5d44ed698b716aa027e17f8e5786eb44b194d10aa4aa229ca52', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-MLICVZOU.css': {size: 619, hash: 'dV914VvR3lE', text: () => import('./assets-chunks/styles-MLICVZOU_css.mjs').then(m => m.default)}
  },
};
