// This config is used in both the
// frontend as well as the web server.

// see https://github.com/askmike/gekko/blob/stable/docs/installing_gekko_on_a_server.md

const CONFIG = {
  headless: false,
  api: {
    host: '127.0.0.1',
    port: 9999,
    timeout: 120000, // 2 minutes
  },
  ui: {
    ssl: false,
    host: 'localhost',
    port: 9999,
    path: '/',
  },
  adapter: 'postgresql',
};

if (typeof window === 'undefined') module.exports = CONFIG;
else window.CONFIG = CONFIG;
