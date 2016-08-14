var t = require('u-test'),
    assert = require('assert'),
    http = require('http'),
    net = require('net'),
    https = require('https'),
    Cb = require('y-callback');

module.exports = desc => t(desc,function*(){
  var cb;

  http.get('http://test.v2.host.com:9000/',cb = Cb());
  assert.equal(yield (yield cb)[0],'hello world');

  http.get('http://127.0.0.1:9100/',cb = Cb());
  assert.equal(yield (yield cb)[0],'hello world');

  http.get('http://sample.host.com:8004/',cb = Cb());
  assert.equal(yield (yield cb)[0],'sample');

  http.get('http://sample.host.com:8104/',cb = Cb());
  assert.equal(yield (yield cb)[0],'sample');

  http.get('http://sample.host.com:9003/',cb = Cb());
  assert.equal(yield (yield cb)[0],'sample');

  http.get('http://host.com:8004/',cb = Cb());
  assert.equal(yield (yield cb)[0],'host');

  https.get({
    host: '127.0.0.1',
    port: 8006,
    path: '/',
    agent: new https.Agent({rejectUnauthorized: false})
  },cb = Cb());

  assert.equal(yield (yield cb)[0],'sample');

  https.get({
    host: 'sample.host.com',
    port: 8006,
    path: '/',
    agent: new https.Agent({rejectUnauthorized: false})
  },cb = Cb());

  assert.equal(yield (yield cb)[0],'sample');

  https.get({
    host: 'sample.host.com',
    port: 8007,
    path: '/',
    agent: new https.Agent({rejectUnauthorized: false})
  },cb = Cb());

  assert.equal(yield (yield cb)[0],'sample');

  https.get({
    host: 'sample.host.com',
    port: 8107,
    path: '/',
    agent: new https.Agent({rejectUnauthorized: false})
  },cb = Cb());

  assert.equal(yield (yield cb)[0],'sample');

});
