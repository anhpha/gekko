var UIconfig = require('../vue/UIconfig');

var config = {};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//                          GENERAL SETTINGS
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

config.silent = false;
config.debug = true;

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//                       CONFIGURING TRADING ADVICE
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

config.watch = {
  // You can set your own tickrate (refresh rate).
  // If you don't set it, the defaults are 2 sec for
  // okcoin and 20 sec for all other exchanges.
  tickrate: 10,
};

config.tradingAdvisor = {};

config.candleWriter = {
  enabled: true,
};
config.adviceWriter = {
  enabled: true,
  muteSoft: true,
};

config.trader = {
  orderUpdateDelay: 1, // Number of minutes to adjust unfilled order prices
};

config.redisBeacon = {
  enabled: false,
  port: 6379, // redis default
  host: 'localhost', // localhost
  // On default Gekko broadcasts
  // events in the channel with
  // the name of the event, set
  // an optional prefix to the
  // channel name.
  channelPrefix: '',
  broadcast: ['candle'],
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//                       CONFIGURING ADAPTER
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// configurable in the UIconfig
config.adapter = UIconfig.adapter;

config.sqlite = {
  path: 'plugins/sqlite',
  version: 0.1,
  dataDirectory: 'history',
  journalMode: require('../isWindows.js') ? 'PERSIST' : 'WAL',
  dependencies: [
    {
      module: 'sqlite3',
      version: '3.1.4',
    },
  ],
};

// Postgres adapter example config (please note: requires postgres >= 9.5):
config.postgresql = {
  path: 'plugins/postgresql',
  version: 0.1,
  connectionString: 'postgres://username:password@localhost:5432', // if default port
  database: 'gekko', // if set, we'll put all tables into a single database.
  schema: 'public',
  dependencies: [
    {
      module: 'pg',
      version: '6.1.0',
    },
  ],
};

// Mongodb adapter, requires mongodb >= 3.3 (no version earlier tested)
config.mongodb = {
  path: 'plugins/mongodb',
  version: 0.1,
  connectionString: 'mongodb://mongodb/gekko', // connection to mongodb server
  dependencies: [
    {
      module: 'mongojs',
      version: '2.4.0',
    },
  ],
};

// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//                       CONFIGURING BACKTESTING
// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Note that these settings are only used in backtesting mode, see here:
// @link: https://github.com/askmike/gekko/blob/stable/docs/Backtesting.md

config.backtest = {
  daterange: 'scan',
  batchSize: 50,
};

config.importer = {
  daterange: {
    // NOTE: these dates are in UTC
    from: '2016-06-01 12:00:00',
  },
};

module.exports = config;
