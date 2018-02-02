/*

  RSI - cykedev 14/02/2014

  (updated a couple of times since, check git history)

 */
// helpers
var _ = require('lodash');
var log = require('../core/log.js');

var RSI = require('./indicators/RSI.js');
var SMA = require('./indicators/SMA.js');

// let's create our own method
var method = {};

// prepare everything our method needs
method.init = function() {
  this.name = 'RSI-PHA';

  this.trend = {
    direction: 'none',
    duration: 0,
    persisted: false,
    adviced: false,
    buy: 0,
    sell: 0,
    action: false,
  };

  this.macdTrend = {
    direction: 'none',
    duration: 0,
    persisted: false,
    adviced: false,
  };
  this.dmaTrend = '';

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('rsi', 'RSI', this.settings);
  // this.addIndicator('sma', 'SMA', 9);
  // this.addIndicator('dema', 'DEMA', this.settings.dma);
  this.addIndicator('macd', 'MACD', this.settings.macd);
};

// for debugging purposes log the last
// calculated parameters.
method.log = function(candle) {
  var digits = 8;
  var rsi = this.indicators.rsi;
  // log.debug(
  //   '\t',
  //   'rsi:',
  //   rsi.result.toFixed(digits),
  //   this.trend.duration,
  //   this.settings.thresholds.persistence
  // );
  if (
    rsi.result < this.settings.thresholds.low &&
    this.trend.duration >= this.settings.thresholds.persistence
  ) {
    // log.debug('calculated RSI properties for candle:');
    // log.debug('\t', 'rsi:', rsi.result.toFixed(digits));
    // log.debug('\t', 'price:', candle.close.toFixed(digits));
    // log.debug('\t', 'buy:', this.trend.buy);
    // log.debug('\t', 'time:', candle.start);
  }
};

method.buyOnMACDCross = function(candle) {
  var macddiff = this.indicators.macd.result;
  var rsiVal = this.indicators.rsi.result;

  if (macddiff > this.settings.macd.up) {
    // new trend detected
    if (this.macdTrend.direction !== 'up')
      // reset the state for the new trend
      this.macdTrend = {
        duration: 0,
        persisted: false,
        direction: 'up',
        adviced: false,
      };

    this.macdTrend.duration++;

    if (this.macdTrend.duration >= this.settings.macd.persistence)
      this.macdTrend.persisted = true;

    if (
      this.macdTrend.persisted &&
      !this.macdTrend.adviced &&
      rsiVal < this.settings.macd.rsi
    ) {
      log.debug(
        '<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Buy on MACD cross',
        this.macdTrend.duration,
        'candle(s)'
      );
      this.doBuy(candle);
      return true;
    }
  } else if (macddiff < this.settings.macd.down) {
    // new trend detected
    if (this.macdTrend.direction !== 'down')
      // reset the state for the new trend
      this.macdTrend = {
        duration: 0,
        persisted: false,
        direction: 'down',
        adviced: false,
      };

    this.macdTrend.duration++;
  }
  return false;
};

method.buyOnSAMCross = function(candle) {
  var dema = this.indicators.dema;
  var diff = dema.result;
  var price = candle.close;
  var message = '@ ' + price.toFixed(8) + ' (' + diff.toFixed(5) + ')';
  if (diff > this.settings.dma.up && this.trend.buy == 0) {
    if (this.dmaTrend !== 'up') {
      log.debug(
        '<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Buy on cross',
        message
      );
      this.dmaTrend = 'up';
      this.doBuy(price);
      return true;
    }
  }
  // else if (diff < this.settings.dma.down) {
  //   log.debug('we are currently in a downtrend', message);

  //   if (this.dmaTrend !== 'down') {
  //     this.dmaTrend = 'down';
  //     this.doSell(price);
  //     return true;
  //   }
  // }
  return false;
};

method.updateTrend = function(direction) {
  // new trend detected
  if (this.trend.direction !== direction) {
    log.debug('Reset trend', this.trend.direction, direction);
    this.trend = {
      duration: 0,
      persisted: false,
      direction: direction,
      adviced: false,
      buy: this.trend.buy,
      sell: this.trend.sell,
    };
  }
  this.trend.duration++;
};

method.sellOnHighRSI = function(rsiVal, candle) {
  if (rsiVal > this.settings.thresholds.high) {
    // new trend detected
    this.updateTrend('high');
    if (
      this.trend.duration >= this.settings.thresholds.highpersistence &&
      candle.low > this.trend.buy
    ) {
      this.trend.persisted = true;
    }

    if (this.trend.buy > 0 && this.trend.persisted && !this.trend.adviced) {
      log.debug(
        '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>SELL:  In high since',
        this.trend.duration,
        'candle(s)'
      );

      this.doSell(candle.close);
    } else {
      this.doNothing();
    }
    return true;
  }
  return false;
};

method.buyOnLowRSI = function(rsiVal, candle) {
  if (rsiVal < this.settings.thresholds.low) {
    // new trend detected
    this.updateTrend('low');

    if (this.trend.duration >= this.settings.thresholds.persistence) {
      this.trend.persisted = true;
    }

    log.debug(
      'Checking to buy:',
      this.trend.buy,
      this.trend.persisted,
      this.trend.adviced,
      this.trend.duration
    );
    if (this.trend.persisted && !this.trend.adviced && this.trend.buy == 0) {
      log.debug(
        '<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<BUY: In low since',
        this.trend.duration,
        'candle(s)'
      );
      this.doBuy(candle.close);
    } else {
      this.doNothing();
    }
    return true;
  }
  return false;
};

method.takeProfit = function(rsiVal, candle) {
  if (
    rsiVal >= this.settings.minrsiprofit &&
    this.trend.buy > 0 &&
    candle.high >= this.trend.buy * (1 + this.settings.microprofit / 100)
  ) {
    log.debug('***********************************SELL: Got target trend');
    this.doSell(candle.close);
    return true;
  }
  return false;
};

method.stopLost = function(rsiVal, candle) {
  if (rsiVal >= this.settings.checklost && this.trend.buy > candle.high) {
    log.debug('***********************************SELL: Stop lost');
    this.doSell(candle.close);
    return true;
  }
  return false;
};

method.doBuy = function(price) {
  this.trend.adviced = true;
  this.trend.action = true;
  this.advice('long');
  this.trend.buy = price;
  this.trend.sell = 0;
};

method.doSell = function(price) {
  this.trend.adviced = true;
  this.trend.action = true;
  this.advice('short');
  this.trend.sell = price;
  this.trend.buy = 0;
};

method.doNothing = function() {
  this.advice();
  this.trend.action = false;
};

method.check = function(candle) {
  var rsi = this.indicators.rsi;
  var rsiVal = rsi.result;

  if (rsiVal <= 0) {
    log.debug('Not enought data for rsi');
    this.doNothing();
    return;
  }

  if (this.sellOnHighRSI(rsiVal, candle)) {
    // log.debug('Done sell');
    return;
  }

  // if (this.buyOnSAMCross(candle)) {
  //   return;
  // }
  if (this.buyOnLowRSI(rsiVal, candle)) {
    // log.debug('Done slow', this.trend.duration);
    return;
  }

  if (this.takeProfit(rsiVal, candle)) {
    // log.debug('Done take profit');
    return;
  }

  if (this.stopLost(rsiVal, candle)) {
    // log.debug('Done stoploss');
    return;
  }
  this.doNothing();

  // if (rsiVal > this.settings.thresholds.high) {
  //   // new trend detected
  //   if (this.trend.direction !== 'high')
  //     this.trend = {
  //       duration: 0,
  //       persisted: false,
  //       direction: 'high',
  //       adviced: false,
  //       buy: this.trend.buy,
  //       sell: this.trend.sell,
  //     };

  //   this.trend.duration++;

  //   if (
  //     this.trend.duration >= this.settings.thresholds.highpersistence &&
  //     candle.low > this.trend.buy
  //   ) {
  //     this.trend.persisted = true;
  //   }

  //   if (this.trend.buy == 0) {
  //     // log.debug('Not buy yet');
  //     this.advice();
  //     this.trend.action = false;
  //     return;
  //   }

  //   if (this.trend.buy > 0 && this.trend.persisted && !this.trend.adviced) {
  //     log.debug(
  //       '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>SELL:  In high since',
  //       this.trend.duration,
  //       'candle(s)'
  //     );

  //     log.debug('Detail:', rsiVal, candle);
  //     this.trend.adviced = true;
  //     this.trend.action = true;
  //     this.advice('short');
  //     this.trend.sell = candle.close;
  //     this.trend.buy = 0;
  //   } else {
  //     this.advice();
  //     this.trend.action = false;
  //   }
  // } else if (rsiVal < this.settings.thresholds.low) {
  //   // new trend detected
  //   if (this.trend.direction !== 'low')
  //     this.trend = {
  //       duration: 0,
  //       persisted: false,
  //       direction: 'low',
  //       adviced: false,
  //       buy: this.trend.buy,
  //       sell: this.trend.sell,
  //     };

  //   this.trend.duration++;

  //   if (this.trend.duration >= this.settings.thresholds.persistence) {
  //     this.trend.persisted = true;
  //   }

  //   log.debug(this.trend.buy);
  //   if (this.trend.persisted && !this.trend.adviced && this.trend.buy == 0) {
  //     log.debug(
  //       '<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<BUY: In low since',
  //       this.trend.duration,
  //       'candle(s)'
  //     );
  //     log.debug('Detail:', rsiVal, candle);
  //     this.trend.adviced = true;
  //     this.advice('long');
  //     this.trend.buy = candle.close;
  //     this.trend.action = true;
  //   } else {
  //     this.trend.action = false;
  //     this.advice();
  //   }
  // } else {
  //   if (
  //     rsiVal >= this.settings.minrsiprofit &&
  //     this.trend.buy > 0 &&
  //     candle.high >= this.trend.buy * (1 + this.settings.microprofit / 100)
  //   ) {
  //     log.debug('***********************************SELL: Got target trend');
  //     log.debug('Detail:', rsiVal, candle);
  //     this.trend.adviced = true;
  //     this.trend.action = true;
  //     this.advice('short');
  //     this.trend.sell = candle.close;
  //     this.trend.buy = 0;
  //   } else {
  //     // log.debug('In no trend');

  //     this.advice();
  //     this.trend.action = false;
  //   }
  // }
};

module.exports = method;
