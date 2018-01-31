var Hitbtc = require('../mylibs/hitbtc');
var util = require('../core/util.js');
var _ = require('lodash');
var moment = require('moment');
var log = require('../core/log');
var rp = require('request-promise');
var fs = require('fs');

// Helper methods
function joinCurrencies(currencyA, currencyB) {
  return currencyB + '' + currencyA;
}

var Trader = function(config) {
  _.bindAll(this);
  if (_.isObject(config)) {
    this.key = config.key;
    this.secret = config.secret;
    this.currency = config.currency;
    this.asset = config.asset;
  }
  this.name = 'HitBTC';
  this.balance;
  this.price;

  this.pair = [this.currency, this.asset].join('');

  this.hitbtc = new Hitbtc(this.key, this.secret);
};

// if the exchange errors we try the same call again after
// waiting 10 seconds
Trader.prototype.retry = function(method, args) {
  var wait = +moment.duration(10, 'seconds');
  log.debug(this.name, 'returned an error, retrying..');

  var self = this;

  // make sure the callback (and any other fn)
  // is bound to Trader
  _.each(args, function(arg, i) {
    if (_.isFunction(arg)) args[i] = _.bind(arg, self);
  });

  // run the failed method again with the same
  // arguments after wait
  setTimeout(function() {
    method.apply(self, args);
  }, wait);
};

Trader.prototype.getPortfolio = function(callback) {
  var args = _.toArray(arguments);
  var set = function(err, data) {
    if (err) return this.retry(this.getPortfolio, args);

    var assetAmount = parseFloat(data[this.asset]);
    var currencyAmount = parseFloat(data[this.currency]);

    if (
      !_.isNumber(assetAmount) ||
      _.isNaN(assetAmount) ||
      !_.isNumber(currencyAmount) ||
      _.isNaN(currencyAmount)
    ) {
      log.info('asset:', this.asset);
      log.info('currency:', this.currency);
      log.info('exchange data:', data);
      util.die('Gekko was unable to set the portfolio');
    }

    var portfolio = [
      { name: this.asset, amount: assetAmount },
      { name: this.currency, amount: currencyAmount },
    ];

    callback(err, portfolio);
  }.bind(this);

  this.hitbtc.myBalances(set);
};

Trader.prototype.getTicker = function(callback) {
  console.log('HitBTC getticker');
  var args = _.toArray(arguments);
  this.hitbtc.getTicker(
    function(err, data) {
      console.log('HitBtc ticker error:', err);
      if (err) return this.retry(this.getTicker, args);

      console.log('HitBtc ticker data:', data);
      var tick = data[this.pair];

      callback(null, {
        bid: parseFloat(tick.highestBid),
        ask: parseFloat(tick.lowestAsk),
      });
    }.bind(this)
  );
};

Trader.prototype.getFee = function(callback) {
  var set = function(err, data) {
    if (err || data.error) return callback(err || data.error);

    callback(false, parseFloat(data.takeLiquidityRate));
  };
  this.hitbtc._private('GET', 'fee/BTCUSD', _.bind(set, this));
};

Trader.prototype.buy = function(amount, price, callback) {
  var args = _.toArray(arguments);
  var set = function(err, result) {
    if (err || result.error) {
      log.error('unable to buy:', err, result);
      return this.retry(this.buy, args);
    }

    callback(null, result.clientOrderId);
  }.bind(this);

  this.hitbtc.buy(this.pair, this.asset, price, amount, set);
};

Trader.prototype.sell = function(amount, price, callback) {
  var args = _.toArray(arguments);
  var set = function(err, result) {
    if (err || result.error) {
      log.error('unable to sell:', err, result);
      return this.retry(this.sell, args);
    }

    callback(null, result.clientOrderId);
  }.bind(this);

  this.hitbtc.sell(this.currency, this.asset, price, amount, set);
};

Trader.prototype.checkOrder = function(order, callback) {
  var check = function(err, result) {
    var stillThere = _.find(result, function(o) {
      return o.orderNumber === order;
    });
    callback(err, !stillThere);
  }.bind(this);

  this.hitbtc.myOpenOrders(this.currency, this.asset, check);
};

Trader.prototype.getOrder = function(order, callback) {
  var get = function(err, result) {
    if (err) return callback(err);

    var price = 0;
    var amount = 0;
    var date = moment(0);

    if (
      result.error ===
      'Order not found, or you are not the person who placed it.'
    )
      return callback(null, { price, amount, date });

    _.each(result, trade => {
      date = moment(trade.date);
      price =
        (price * amount + +trade.rate * trade.amount) /
        (+trade.amount + amount);
      amount += +trade.amount;
    });

    callback(err, { price, amount, date });
  }.bind(this);

  this.hitbtc.returnOrderTrades(order, get);
};

Trader.prototype.cancelOrder = function(order, callback) {
  var args = _.toArray(arguments);
  var cancel = function(err, result) {
    // check if order is gone already
    if (result.message === 'Order not found') return callback(true);

    if (err || result.status !== 'canceled') {
      log.error(
        'unable to cancel order',
        order,
        '(',
        err,
        result,
        '), retrying'
      );
      return this.retry(this.cancelOrder, args);
    }

    callback();
  }.bind(this);

  this.hitbtc.cancelOrder(this.currency, this.asset, order, cancel);
};

Trader.prototype.getTrades = function(since, callback, descending) {
  var firstFetch = !!since;

  var args = _.toArray(arguments);
  var process = function(err, result) {
    if (err) {
      return this.retry(this.getTrades, args);
    }

    // Edge case, see here:
    // @link https://github.com/askmike/gekko/issues/479
    if (firstFetch && _.size(result) === 50000)
      util.die(
        [
          'Hitbtc did not provide enough data. Read this:',
          'https://github.com/askmike/gekko/issues/479',
        ].join('\n\n')
      );

    result = _.map(result, function(trade) {
      return {
        tid: trade.id,
        amount: +trade.quantity,
        date: moment.utc(trade.timestamp).unix(),
        price: +trade.price,
      };
    });

    // console.log('Get trade:', result);
    callback(null, result.reverse());
  };

  var params = {
    by: 'timestamp',
    limit: '1000',
  };

  if (since) params.from = since.unix();

  this.hitbtc._public(
    'trades/' + joinCurrencies(this.currency, this.asset),
    params,
    _.bind(process, this)
  );
};

Trader.getCapabilities = function() {
  // var hitbtc = new Hitbtc('', 'this.secret');

  // var currencies = [];
  // var getCurrencies = function(err, result) {
  //   if (!!err) {
  //     console.log(err);
  //     return;
  //   }
  //   currencies = _.map(result, c => c.id);
  //   // fs.appendFile('hitbtc.json', JSON.stringify(currencies), function(err) {
  //   //   if (err) throw err;
  //   //   console.log('Saved!');
  //   // });
  // };
  // // console.log(currencies);
  // hitbtc._public('currency', getCurrencies);

  // var marketData = [];
  // var getMarketData = function(error, result) {
  //   if (!!error) return;
  //   marketData = _.map(result, s => ({
  //     pair: [s.quoteCurrency, s.baseCurrency],
  //     minimalOrder: {
  //       amount: s.tickSize,
  //       unit: 'asset',
  //     },
  //   }));
  //   fs.appendFile('hitbtc.json', JSON.stringify(marketData), function(err) {
  //     if (err) throw err;
  //     console.log('Saved!');
  //   });
  // };
  // hitbtc._public('symbol', getMarketData);

  return {
    name: 'Hitbtc',
    slug: 'hitbtc',
    currencies: [
      '1ST',
      '8BT',
      'ADX',
      'AE',
      'AEON',
      'AIR',
      'AMB',
      'AMM',
      'AMP',
      'ANT',
      'ARDR',
      'ARN',
      'ART',
      'ATB',
      'ATL',
      'ATM',
      'ATS',
      'AVT',
      'B2X',
      'BAS',
      'BCC',
      'BCH',
      'BCN',
      'BET',
      'BKB',
      'BMC',
      'BMT',
      'BNT',
      'BOS',
      'BQX',
      'BTC',
      'BTCA',
      'BTG',
      'BTM',
      'BTX',
      'BUS',
      'C20',
      'CAPP',
      'CAT',
      'CCT',
      'CDT',
      'CDX',
      'CFI',
      'CL',
      'CLD',
      'CND',
      'CNX',
      'COSS',
      'CPAY',
      'CRS',
      'CSNO',
      'CTR',
      'CTX',
      'CVC',
      'DASH',
      'DATA',
      'DBIX',
      'DCN',
      'DCT',
      'DDF',
      'DENT',
      'DGB',
      'DGD',
      'DICE',
      'DIM',
      'DLT',
      'DNT',
      'DOGE',
      'DOV',
      'DRPU',
      'DRT',
      'DSH',
      'EBET',
      'EBTC',
      'EBTCOLD',
      'ECH',
      'EDG',
      'EDO',
      'EET',
      'EKO',
      'ELE',
      'ELM',
      'EMC',
      'EMGO',
      'ENG',
      'ENJ',
      'EOS',
      'ERO',
      'ETBS',
      'ETC',
      'ETH',
      'ETP',
      'EVX',
      'EXN',
      'FCN',
      'FRD',
      'FUEL',
      'FUN',
      'FYN',
      'FYP',
      'GAME',
      'GNO',
      'GRPH',
      'GUP',
      'GVT',
      'HAC',
      'HDG',
      'HGT',
      'HPC',
      'HRB',
      'HSR',
      'HVN',
      'ICN',
      'ICO',
      'ICOS',
      'ICX',
      'IDH',
      'IGNIS',
      'IML',
      'IND',
      'INDI',
      'IPL',
      'ITS',
      'IXT',
      'KBR',
      'KICK',
      'KMD',
      'LA',
      'LAT',
      'LEND',
      'LIFE',
      'LOC',
      'LRC',
      'LSK',
      'LTC',
      'LUN',
      'MAID',
      'MANA',
      'MCAP',
      'MCO',
      'MIPS',
      'MNE',
      'MPK',
      'MRV',
      'MSP',
      'MTH',
      'MYB',
      'NDC',
      'NEBL',
      'NEO',
      'NET',
      'NGC',
      'NTO',
      'NXC',
      'NXT',
      'OAX',
      'ODN',
      'OMG',
      'OPT',
      'ORME',
      'OTN',
      'OTX',
      'PAY',
      'PBKX',
      'PING',
      'PIX',
      'PLBT',
      'PLR',
      'PLU',
      'POE',
      'POLL',
      'PPC',
      'PPT',
      'PQT',
      'PRE',
      'PREMINE',
      'PRG',
      'PRO',
      'PTOY',
      'QAU',
      'QCN',
      'QTUM',
      'QVT',
      'REP',
      'RKC',
      'RLC',
      'ROOTS',
      'RVT',
      'SAN',
      'SBD',
      'SBTC',
      'SC',
      'SCL',
      'SISA',
      'SKIN',
      'SMART',
      'SMS',
      'SNC',
      'SNGLS',
      'SNM',
      'SNT',
      'SPF',
      'STAR',
      'STEEM',
      'STORM',
      'STRAT',
      'STU',
      'STX',
      'SUB',
      'SUR',
      'SWFTC',
      'SWT',
      'TAAS',
      'TBT',
      'TFL',
      'TGT',
      'TIME',
      'TIO',
      'TIX',
      'TKN',
      'TKR',
      'TNT',
      'TRST',
      'TRX',
      'UET',
      'UGT',
      'ULTC',
      'USD',
      'UTT',
      'VEN',
      'VERI',
      'VIB',
      'VIBE',
      'VOISE',
      'WAVES',
      'WAX',
      'WEALTH',
      'WINGS',
      'WMGO',
      'WRC',
      'WTC',
      'WTT',
      'XAUR',
      'XDN',
      'XDNCO',
      'XDNICCO',
      'XEM',
      'XLC',
      'XMR',
      'XRP',
      'XTZ',
      'XUC',
      'XVG',
      'YOYOW',
      'ZAP',
      'ZEC',
      'ZRC',
      'ZRX',
      'ZSC',
    ],
    assets: [
      '1ST',
      '8BT',
      'ADX',
      'AE',
      'AEON',
      'AIR',
      'AMB',
      'AMM',
      'AMP',
      'ANT',
      'ARDR',
      'ARN',
      'ART',
      'ATB',
      'ATL',
      'ATM',
      'ATS',
      'AVT',
      'B2X',
      'BAS',
      'BCC',
      'BCH',
      'BCN',
      'BET',
      'BKB',
      'BMC',
      'BMT',
      'BNT',
      'BOS',
      'BQX',
      'BTC',
      'BTCA',
      'BTG',
      'BTM',
      'BTX',
      'BUS',
      'C20',
      'CAPP',
      'CAT',
      'CCT',
      'CDT',
      'CDX',
      'CFI',
      'CL',
      'CLD',
      'CND',
      'CNX',
      'COSS',
      'CPAY',
      'CRS',
      'CSNO',
      'CTR',
      'CTX',
      'CVC',
      'DASH',
      'DATA',
      'DBIX',
      'DCN',
      'DCT',
      'DDF',
      'DENT',
      'DGB',
      'DGD',
      'DICE',
      'DIM',
      'DLT',
      'DNT',
      'DOGE',
      'DOV',
      'DRPU',
      'DRT',
      'DSH',
      'EBET',
      'EBTC',
      'EBTCOLD',
      'ECH',
      'EDG',
      'EDO',
      'EET',
      'EKO',
      'ELE',
      'ELM',
      'EMC',
      'EMGO',
      'ENG',
      'ENJ',
      'EOS',
      'ERO',
      'ETBS',
      'ETC',
      'ETH',
      'ETP',
      'EVX',
      'EXN',
      'FCN',
      'FRD',
      'FUEL',
      'FUN',
      'FYN',
      'FYP',
      'GAME',
      'GNO',
      'GRPH',
      'GUP',
      'GVT',
      'HAC',
      'HDG',
      'HGT',
      'HPC',
      'HRB',
      'HSR',
      'HVN',
      'ICN',
      'ICO',
      'ICOS',
      'ICX',
      'IDH',
      'IGNIS',
      'IML',
      'IND',
      'INDI',
      'IPL',
      'ITS',
      'IXT',
      'KBR',
      'KICK',
      'KMD',
      'LA',
      'LAT',
      'LEND',
      'LIFE',
      'LOC',
      'LRC',
      'LSK',
      'LTC',
      'LUN',
      'MAID',
      'MANA',
      'MCAP',
      'MCO',
      'MIPS',
      'MNE',
      'MPK',
      'MRV',
      'MSP',
      'MTH',
      'MYB',
      'NDC',
      'NEBL',
      'NEO',
      'NET',
      'NGC',
      'NTO',
      'NXC',
      'NXT',
      'OAX',
      'ODN',
      'OMG',
      'OPT',
      'ORME',
      'OTN',
      'OTX',
      'PAY',
      'PBKX',
      'PING',
      'PIX',
      'PLBT',
      'PLR',
      'PLU',
      'POE',
      'POLL',
      'PPC',
      'PPT',
      'PQT',
      'PRE',
      'PREMINE',
      'PRG',
      'PRO',
      'PTOY',
      'QAU',
      'QCN',
      'QTUM',
      'QVT',
      'REP',
      'RKC',
      'RLC',
      'ROOTS',
      'RVT',
      'SAN',
      'SBD',
      'SBTC',
      'SC',
      'SCL',
      'SISA',
      'SKIN',
      'SMART',
      'SMS',
      'SNC',
      'SNGLS',
      'SNM',
      'SNT',
      'SPF',
      'STAR',
      'STEEM',
      'STORM',
      'STRAT',
      'STU',
      'STX',
      'SUB',
      'SUR',
      'SWFTC',
      'SWT',
      'TAAS',
      'TBT',
      'TFL',
      'TGT',
      'TIME',
      'TIO',
      'TIX',
      'TKN',
      'TKR',
      'TNT',
      'TRST',
      'TRX',
      'UET',
      'UGT',
      'ULTC',
      'USD',
      'UTT',
      'VEN',
      'VERI',
      'VIB',
      'VIBE',
      'VOISE',
      'WAVES',
      'WAX',
      'WEALTH',
      'WINGS',
      'WMGO',
      'WRC',
      'WTC',
      'WTT',
      'XAUR',
      'XDN',
      'XDNCO',
      'XDNICCO',
      'XEM',
      'XLC',
      'XMR',
      'XRP',
      'XTZ',
      'XUC',
      'XVG',
      'YOYOW',
      'ZAP',
      'ZEC',
      'ZRC',
      'ZRX',
      'ZSC',
    ],
    markets: require('./hitbtc.json'),
    requires: ['key', 'secret'],
    tid: 'tid',
    providesHistory: 'date',
    providesFullHistory: true,
    tradable: true,
  };
};

async function getCurrencies() {
  var data = await rp('https://api.hitbtc.com/api/2/public/currency');
}

module.exports = Trader;
