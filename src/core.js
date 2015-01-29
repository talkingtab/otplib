/*
 * otplib - One-Time Password Library
 * http://github.com/yeojz/otplib
 *
 * Copyright (c) 2014 Gerald Yeo
 * Licensed under the MIT license.
 *
 *
 * Reference
 * --------------------------
 *   - http://en.wikipedia.org/wiki/HMAC-based_One-time_Password_Algorithm
 *   - http://en.wikipedia.org/wiki/Time-based_One-time_Password_Algorithm
 *   - http://tools.ietf.org/html/rfc4226
 *   - http://tools.ietf.org/html/rfc6238
 *
 *
 * HOTP
 * --------------------------
 *   Let:
 *    - K be a secret secret
 *    - C be a counter
 *    - HMAC(K,C) = SHA1(K & 0x5c5c... | SHA1(K & 0x3636... | C))
 *      be an HMAC calculated with the SHA-1 cryptographic hash algorithm
 *    - Truncate be a function that selects 4 bytes from the result of the
 *      HMAC in a defined manner
 *    - HOTP(K,C) = Truncate(HMAC(K,C)) & 0x7FFFFFFF
 *    - HOTP-Value = HOTP(K,C) mod 10d, where d is the desired number of digits
 *
 *
 * TOTP
 * --------------------------
 *   Let:
 *    - T0 be an epoch
 *    - TS be the time stemp
 *    - TC be the current timestamp turned into an int, using defined T0, counting in TS units
 *    - TC = (unixtime(now) - unixtime(T0)) / TS
 *    - TOTP = HOTP(secretsecret, TC), where the HOTP algorithm is defined below.
 *    - TOTP-Value = TOTP mod 10d, where d is the desired number of digits of the one-time password.
 *
 */

'use strict';




/*
 *  Libraries
 */
var cryptoHmac = require('crypto');








/*
 *  Initialization
 */
var OTP = function otp() {

  // Final OTP Length
  this.digits = 6;

  // Seconds (TOTP)
  this.timeStep = 30;

  // Console log debug messages
  this.debug = false;

  // Testing
  this.test = false;
};








/*
 *  HMAC based OTP
 *
 *  Note: SHA1 -> 160 bits, 40 char hex length, 1 char = 4bits
 */
OTP.prototype.hotp = function hotp(secret, counter) {

      // Convert to hex
  var _secret = this.helpers.stringToHex(secret);

      // Must be either a buffer or string for hmac fx
  var _counter = this.helpers.intToHex(counter);
      _counter = this.helpers.pad(_counter, 16);

      // crypto library
  var _crypto = cryptoHmac.createHmac('sha1', new Buffer(_secret, 'hex')),
      _hmac = _crypto.update(new Buffer(_counter, 'hex')).digest('hex'),

      // offset := last nibble of hash
      _offset = this.helpers.hexToInt(_hmac.substr(_hmac.length-1)),

      // truncatedHash := hash[offset..offset+3]  //4 bytes starting at the offset
      _truncatedHash = _hmac.substr(_offset*2, 8),

      // Set the first bit of truncatedHash to zero  //remove the most significant bit
      _sigbit0 = this.helpers.hexToInt(_truncatedHash) & this.helpers.hexToInt('7fffffff'),

      // code := truncatedHash mod 1000000
      _code = _sigbit0 % Math.pow(10, this.digits);


  // pad code with 0 until length of code is 6
  _code = this.helpers.pad(_code, this.digits);


  if (this.debug){
    console.log(' hex : ' + _secret);
    console.log(' epoch : ' + _counter);
    console.log(' hmac : ' + _hmac);
    console.log(' token : ' + _code);
  }


  return _code;
};








/*
 *  Time based OTP
 */
OTP.prototype.totp = function totp(secret) {

  // Debug
  var depoch = (this.test) ? arguments[1] : undefined;

  // Current System Time (T0)
  var _epoch = depoch || new Date().getTime(),

      // Time in Seconds (TS)
      _timeStep = this.timeStep,

      // The Counter for HOTP (TC)
      _timeCounter = Math.floor(_epoch / (_timeStep * 1000.0)),

      // Send it over to HOTP
      _totp = this.hotp(secret, _timeCounter);

  if (this.debug){
    console.log(' time : ' + _timeCounter);
  }

  return _totp;
};








/*
 *  Utilities to management secrets
 */
OTP.prototype.secret = {

  // Generate a random secret
  generate: function generate(length) {
    var _random = '';

    length = length || 16;

    for (var i = 0; i < length; i++){
      _random += Math.random().toString(26).slice(2,3);
    }

    return _random;
  },

  removeSpaces: function removeSpaces(secret){
    return secret.replace(/\s+/g, '');
  },

  divideIntoSetsOf: function divideIntoSetsOf(num, secret){
    var regex = '';

    num = num || 4;    
    regex = new RegExp('.{1,'+num+'}', 'g');

    return (secret) ? secret.match(regex).join(' ') : '';
  }

};








/*
 *  Simple checking method for token
 */

OTP.prototype.checkTOTP = function checkTOTP(token, secret){
  var _systemToken = this.totp(secret, arguments[2]);

  return this.helpers.isSameToken(token, _systemToken);
};




OTP.prototype.checkHOTP = function checkHOTP(token, secret, counter){

  var _counter = counter || 0,
      _systemToken = this.hotp(secret, _counter);

  return this.helpers.isSameToken(token, _systemToken);
};








/*
 *  Helpers (mostly for internal use)
 */
OTP.prototype.helpers = {

  // Compares 2 tokens
  isSameToken: function(token1, token2){
    return (parseInt(token1) === parseInt(token2)) ? true : false;
  },


  // Converts String to Hex
  stringToHex: function stringToHex(value) {
    var _hex = '',
        _tmp = '';

    for (var i = 0; i < value.length; i++){

      // Convert to Hex and Ensure it's in 2 digit sets
      _tmp = ('0000' + value.charCodeAt(i).toString(16)).slice(-2);

      // Append
      _hex += '' + _tmp;
    }

    return _hex;
  },


  // Converts Hex into an Integer
  hexToInt: function hexToInt(hex) {
    return parseInt(hex, 16);
  },


  // Parse number into an Integer and convert to Hex
  intToHex: function intToHex(number) {
    return parseInt(number).toString(16);
  },


  // Do a left padding of the value based on the total
  pad: function pad(value, total) {
    // Convert to string
    var _value = value + '',
        _total = total || 0;

    // pad
    while (_value.length < _total){
      _value = '0' + _value;
    }

    return _value;
  }

};




module.exports = new OTP();
