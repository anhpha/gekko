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

  this.requiredHistory = this.tradingAdvisor.historySize;

  // define the indicators we need
  this.addIndicator('rsi', 'RSI', this.settings);
  this.addIndicator('sma', 'SMA', 9);
};

// for debugging purposes log the last
// calculated parameters.
method.log = function(candle) {
  if (!!this.trend.action) {
    var digits = 8;
    var rsi = this.indicators.rsi;
    log.debug('calculated RSI properties for candle:');
    log.debug('\t', 'rsi:', rsi.result.toFixed(digits));
    log.debug('\t', 'price:', candle.close.toFixed(digits));
    log.debug('\t', 'buy:', this.trend.buy);
    log.debug('\t', 'time:', candle.start);
  }
};

method.check = function(candle) {
  var rsi = this.indicators.rsi;
  var rsiVal = rsi.result;

  if (rsiVal > this.settings.thresholds.high) {
    // new trend detected
    if (this.trend.direction !== 'high')
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'high',
        adviced: false,
        buy: this.trend.buy,
        sell: this.trend.sell,
      };

    this.trend.duration++;

    if (
      this.trend.duration >= this.settings.thresholds.persistence &&
      candle.low > this.trend.buy
    ) {
      this.trend.persisted = true;
    }

    if (this.trend.buy == 0) {
      log.debug('Not buy yet');
      this.advice();
      this.trend.action = false;
      return;
    }

    if (this.trend.buy > 0 && this.trend.persisted && !this.trend.adviced) {
      log.debug(
        '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>SELL:  In high since',
        this.trend.duration,
        'candle(s)'
      );

      log.debug('Detail:', rsiVal, candle);
      this.trend.adviced = true;
      this.trend.action = true;
      this.advice('short');
      this.trend.sell = candle.close;
      this.trend.buy = 0;
    } else {
      this.advice();
      this.trend.action = false;
    }
  } else if (rsiVal < this.settings.thresholds.low) {
    // new trend detected
    if (this.trend.direction !== 'low')
      this.trend = {
        duration: 0,
        persisted: false,
        direction: 'low',
        adviced: false,
        buy: this.trend.buy,
        sell: this.trend.sell,
      };

    this.trend.duration++;

    if (this.trend.duration >= this.settings.thresholds.persistence) {
      this.trend.persisted = true;
    }

    log.debug(this.trend.buy);
    if (this.trend.persisted && !this.trend.adviced && this.trend.buy == 0) {
      log.debug(
        '<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<BUY: In low since',
        this.trend.duration,
        'candle(s)'
      );
      log.debug('Detail:', rsiVal, candle);
      this.trend.adviced = true;
      this.advice('long');
      this.trend.buy = candle.close;
      this.trend.action = true;
    } else {
      this.trend.action = false;
      this.advice();
    }
  } else {
    if (this.trend.buy > 0 && candle.close >= this.trend.buy * 1.05) {
      log.debug('***********************************SELL: Got target trend');
      log.debug('Detail:', rsiVal, candle);
      this.trend.adviced = true;
      this.trend.action = true;
      this.advice('short');
      this.trend.sell = candle.close;
      this.trend.buy = 0;
    } else {
      // log.debug('In no trend');

      this.advice();
      this.trend.action = false;
    }
  }
};

module.exports = method;
