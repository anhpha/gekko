/*
 * CCI
 */
var log = require('../../core/log');

var Indicator = function(settings) {
  this.input = 'candle';
  this.result = false;
  this.hist = []; // needed for mean?
  this.trend = 0;
  this.size = 0;
  //   this.constant = settings.constant;
  this.maxSize = settings.history;
};

Indicator.prototype.update = function(candle) {
  // We need sufficient history to get the right result.
  this.hist.push(candle);
  this.size++;
  if (candle.open < candle.close) {
    if (this.size == 1) {
      return;
    } else {
      var currentHeight = candle.close - candle.open;
      var lastHeight =
        this.hist[this.size - 2].close - this.hist[this.size - 2].open;

      // 2 candles up and the second not too high
      if (lastHeight > 0 && currentHeight < 5 * lastHeight) {
        this.trend = 1;
      } else {
        this.trend = 0;
      }
    }
  } else {
    this.trend = -1;
  }
  // Check 3 candles, 2 up after 1 down => true
  if (this.size > 2) {
    if (
      this.hist[this.size - 3].open > this.hist[this.size - 3].close &&
      this.trend == 1
    ) {
      this.result++;
    }
  }
};

module.exports = Indicator;
