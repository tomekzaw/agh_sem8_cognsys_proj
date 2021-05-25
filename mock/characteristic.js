const bleno = require("@abandonware/bleno");
const BlenoCharacteristic = bleno.Characteristic;

const util = require("util");

const characteristicUUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const notifyInterval = 1000; // 1 second
const generator = require("./generators").traffic_lights();

var CustomCharacteristic = function () {
  CustomCharacteristic.super_.call(this, {
    uuid: characteristicUUID,
    properties: ["read", "write", "notify"],
  });

  this._value = Buffer.from([]);
  this._updateValueCallback = null;
};

util.inherits(CustomCharacteristic, BlenoCharacteristic);
module.exports = CustomCharacteristic;

CustomCharacteristic.prototype.onReadRequest = function (offset, callback) {
  const state = generator.next().value;
  const data = Buffer.from(JSON.stringify(state));
  callback(this.RESULT_SUCCESS, data);
};

CustomCharacteristic.prototype.onSubscribe = function (
  maxValueSize,
  updateValueCallback
) {
  isSubscribed = true;
  loopNotify(updateValueCallback);
  this._updateValueCallback = updateValueCallback;
};

CustomCharacteristic.prototype.onUnsubscribe = function () {
  isSubscribed = false;
  this._updateValueCallback = null;
};

var isSubscribed = false;

function notify(callback) {
  const state = generator.next().value;
  const data = Buffer.from(JSON.stringify(state));
  callback(data);
}

function loopNotify(callback) {
  setTimeout(function () {
    if (isSubscribed) {
      notify(callback);
      loopNotify(callback);
    }
  }, notifyInterval);
}
