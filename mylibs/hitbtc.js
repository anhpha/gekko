module.exports = (function() {
  'use strict';

  // Module dependencies
  var crypto = require('crypto'),
    request = require('request'),
    nonce = require('nonce')();

  // Constants
  var version = '0.0.1',
    PUBLIC_API_URL = 'api.hitbtc.com/api/2/public',
    PRIVATE_API_URL = 'api.hitbtc.com/api/2/trading',
    API_SCHEMA = 'https://',
    // USER_AGENT = 'poloniex.js ' + version;
    USER_AGENT =
      'Mozilla/5.0 (Windows NT 6.3; WOW64; rv:26.0) Gecko/20100101 Firefox/26.0';

  // Helper methods
  function joinCurrencies(currencyA, currencyB) {
    // If only one arg, then return the first
    if (typeof currencyB !== 'string') {
      return currencyA;
    }

    return currencyB + '' + currencyA;
  }

  // Constructor
  function Hitbtc(key, secret) {
    this.key = key;
    this.secret = secret;
    // Generate headers signed by this user's key and secret.
    // The secret is encapsulated and never exposed
    // this._getPrivateHeaders = function(parameters) {
    //   var paramString, signature;
    //   if (!key || !secret) {
    //     throw 'Hitbtc: Error. API key and secret required';
    //   }
    //   // Convert to `arg1=foo&arg2=bar`
    //   paramString = Object.keys(parameters)
    //     .map(function(param) {
    //       return (
    //         encodeURIComponent(param) +
    //         '=' +
    //         encodeURIComponent(parameters[param])
    //       );
    //     })
    //     .join('&');
    //   signature = crypto
    //     .createHmac('sha512', secret)
    //     .update(paramString)
    //     .digest('hex');
    //   return {
    //     Key: key,
    //     Sign: signature,
    //   };
    // };
  }

  // Currently, this fails with `Error: CERT_UNTRUSTED`
  // Hitbtc.STRICT_SSL can be set to `false` to avoid this. Use with caution.
  // Will be removed in future, once this is resolved.
  Hitbtc.STRICT_SSL = true;

  // Customisable user agent string
  Hitbtc.USER_AGENT = USER_AGENT;

  // Prototype
  Hitbtc.prototype = {
    constructor: Hitbtc,

    // Make an API request
    _request: function(options, callback) {
      if (!('headers' in options)) {
        options.headers = {};
      }

      options.json = true;
      options.headers['User-Agent'] = Hitbtc.USER_AGENT;
      //   options.strictSSL = Hitbtc.STRICT_SSL;

      request(options, function(err, response, body) {
        // Empty response
        if (!err && (typeof body === 'undefined' || body === null)) {
          err = 'Empty response';
        }

        callback(err, body);
      });

      return this;
    },

    // Make a public API request
    _public: function(path, parameters, callback) {
      var options;

      if (typeof parameters === 'function') {
        callback = parameters;
        parameters = {};
      }

      parameters || (parameters = {});
      options = {
        method: 'GET',
        url: API_SCHEMA + PUBLIC_API_URL + '/' + path,
        qs: parameters,
      };

      return this._request(options, callback);
    },

    // Make a private API request
    _private: function(method, parameters, callback) {
      var options;

      if (typeof parameters === 'function') {
        callback = parameters;
        parameters = {};
      }

      parameters || (parameters = {});
      parameters.command = command;
      //   parameters.nonce = nonce();

      options = {
        method: method,
        url: API_SCHEMA + this.key + ':' + this.secret + '@' + PRIVATE_API_URL,
        // form: parameters,
        // headers: this._getPrivateHeaders(parameters),
      };

      if (method !== 'GET') {
        options.qs = parameters;
      } else {
        options.form = parameters;
      }

      return this._request(options, callback);
    },

    /////
    // PUBLIC METHODS

    returnTicker: function(callback) {
      return this._public('ticker', callback);
    },

    return24hVolume: function(callback) {
      return this._public('return24hVolume', callback);
    },

    returnOrderBook: function(currencyA, currencyB, callback) {
      //   var parameters = {
      //     currencyPair: joinCurrencies(currencyA, currencyB),
      //   };

      return this._public(
        'orderbook/' + joinCurrencies(currencyA, currencyB),
        {},
        callback
      );
    },

    returnChartData: function(
      currencyA,
      currencyB,
      period,
      start,
      end,
      callback
    ) {
      //   var parameters = {
      //     currencyPair: joinCurrencies(currencyA, currencyB),
      //     period: period,
      //     start: start,
      //     end: end,
      //   };

      return this._public(
        'candles/' + joinCurrencies(currencyA, currencyB),
        {},
        callback
      );
    },

    returnCurrencies: function(callback) {
      return this._public('currency', callback);
    },

    returnLoanOrders: function(currency, callback) {
      return this._public('returnLoanOrders', { currency: currency }, callback);
    },

    /////
    // PRIVATE METHODS

    returnBalances: function(callback) {
      return this._private('GET', 'balance', {}, callback);
    },

    returnCompleteBalances: function(callback) {
      return this._private('returnCompleteBalances', {}, callback);
    },

    returnDepositAddresses: function(callback) {
      return this._private('returnDepositAddresses', {}, callback);
    },

    generateNewAddress: function(currency, callback) {
      return this._private(
        'returnDepositsWithdrawals',
        { currency: currency },
        callback
      );
    },

    returnDepositsWithdrawals: function(start, end, callback) {
      return this._private(
        'returnDepositsWithdrawals',
        { start: start, end: end },
        callback
      );
    },

    returnOpenOrders: function(currencyA, currencyB, callback) {
      //   var parameters = {
      //     currencyPair: joinCurrencies(currencyA, currencyB),
      //   };

      return this._private(
        'GET',
        'order/' + joinCurrencies(currencyA, currencyB),
        callback
      );
    },

    returnTradeHistory: function(currencyA, currencyB, callback) {
      //   var parameters = {
      //     currencyPair: joinCurrencies(currencyA, currencyB),
      //   };

      return this._private(
        'GET',
        'history/trade/' + joinCurrencies(currencyA, currencyB),
        callback
      );
    },

    returnOrderTrades: function(orderNumber, callback) {
      //   var parameters = {
      //     orderNumber: orderNumber,
      //   };

      return this._private('GET', 'order/' + orderNumber, callback);
    },

    buy: function(currencyA, currencyB, rate, amount, callback) {
      var parameters = {
        symbol: joinCurrencies(currencyA, currencyB),
        side: 'buy',
        price: rate,
        quantity: amount,
      };

      return this._private('POST', 'order', parameters, callback);
    },

    sell: function(currencyA, currencyB, rate, amount, callback) {
      var parameters = {
        symbol: joinCurrencies(currencyA, currencyB),
        side: 'sell',
        price: rate,
        quantity: amount,
      };

      return this._private('POST', 'order', parameters, callback);
    },

    cancelOrder: function(currencyA, currencyB, orderNumber, callback) {
      //   var parameters = {
      //     currencyPair: joinCurrencies(currencyA, currencyB),
      //     orderNumber: orderNumber,
      //   };

      return this._private('DELETE', 'order/' + orderNumber, {}, callback);
    },

    moveOrder: function(orderNumber, rate, amount, callback) {
      var parameters = {
        orderNumber: orderNumber,
        rate: rate,
        amount: amount ? amount : null,
      };

      return this._private('moveOrder', parameters, callback);
    },

    withdraw: function(currency, amount, address, callback) {
      var parameters = {
        currency: currency,
        amount: amount,
        address: address,
      };

      return this._private('withdraw', parameters, callback);
    },

    returnFeeInfo: function(callback) {
      return this._private('returnFeeInfo', {}, callback);
    },

    returnAvailableAccountBalances: function(account, callback) {
      var options = {};
      if (account) {
        options.account = account;
      }
      return this._private('returnAvailableAccountBalances', options, callback);
    },

    returnTradableBalances: function(callback) {
      return this._private('returnTradableBalances', {}, callback);
    },

    transferBalance: function(
      currency,
      amount,
      fromAccount,
      toAccount,
      callback
    ) {
      var parameters = {
        currency: currency,
        amount: amount,
        fromAccount: fromAccount,
        toAccount: toAccount,
      };

      return this._private('transferBalance', parameters, callback);
    },

    returnMarginAccountSummary: function(callback) {
      return this._private('returnMarginAccountSummary', {}, callback);
    },

    marginBuy: function(
      currencyA,
      currencyB,
      rate,
      amount,
      lendingRate,
      callback
    ) {
      var parameters = {
        currencyPair: joinCurrencies(currencyA, currencyB),
        rate: rate,
        amount: amount,
        lendingRate: lendingRate ? lendingRate : null,
      };

      return this._private('marginBuy', parameters, callback);
    },

    marginSell: function(
      currencyA,
      currencyB,
      rate,
      amount,
      lendingRate,
      callback
    ) {
      var parameters = {
        currencyPair: joinCurrencies(currencyA, currencyB),
        rate: rate,
        amount: amount,
        lendingRate: lendingRate ? lendingRate : null,
      };

      return this._private('marginSell', parameters, callback);
    },

    getMarginPosition: function(currencyA, currencyB, callback) {
      var parameters = {
        currencyPair: joinCurrencies(currencyA, currencyB),
      };

      return this._private('getMarginPosition', parameters, callback);
    },

    closeMarginPosition: function(currencyA, currencyB, callback) {
      var parameters = {
        currencyPair: joinCurrencies(currencyA, currencyB),
      };

      return this._private('closeMarginPosition', parameters, callback);
    },

    createLoanOffer: function(
      currency,
      amount,
      duration,
      autoRenew,
      lendingRate,
      callback
    ) {
      var parameters = {
        currency: currency,
        amount: amount,
        duration: duration,
        autoRenew: autoRenew,
        lendingRate: lendingRate,
      };

      return this._private('createLoanOffer', parameters, callback);
    },

    cancelLoanOffer: function(orderNumber, callback) {
      var parameters = {
        orderNumber: orderNumber,
      };

      return this._private('cancelLoanOffer', parameters, callback);
    },

    returnOpenLoanOffers: function(callback) {
      return this._private('returnOpenLoanOffers', {}, callback);
    },

    returnActiveLoans: function(callback) {
      return this._private('returnActiveLoans', {}, callback);
    },

    toggleAutoRenew: function(orderNumber, callback) {
      return this._private(
        'toggleAutoRenew',
        { orderNumber: orderNumber },
        callback
      );
    },
  };

  // Backwards Compatibility
  Hitbtc.prototype.getTicker = Hitbtc.prototype.returnTicker;
  Hitbtc.prototype.get24hVolume = Hitbtc.prototype.return24hVolume;
  Hitbtc.prototype.getOrderBook = Hitbtc.prototype.returnOrderBook;
  Hitbtc.prototype.getTradeHistory = Hitbtc.prototype.returnChartData;
  Hitbtc.prototype.myBalances = Hitbtc.prototype.returnBalances;
  Hitbtc.prototype.myOpenOrders = Hitbtc.prototype.returnOpenOrders;
  Hitbtc.prototype.myTradeHistory = Hitbtc.prototype.returnTradeHistory;

  return Hitbtc;
})();
