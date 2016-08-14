var t = require('u-test'),
    assert = require('assert'),
    http = require('http'),
    net = require('net'),
    tls = require('tls'),
    https = require('https'),
    Cb = require('y-callback'),
    wait = require('y-timers/wait');

module.exports = desc => t(desc,function*(){
  var req,cb,cb2;

  req = http.get('http://fake.com:8004/');
  req.on('error',cb = Cb());
  yield cb;

  req = http.get('http://fake.com:8010/');
  req.on('error',cb = Cb());
  yield cb;

  req = http.get('http://fake.com:8005/');
  req.on('error',cb = Cb());
  yield cb;

  req = http.get('http://127.0.0.1:8006/');
  req.on('error',cb = Cb());
  yield cb;

  req = net.connect(8004);
  yield wait(100);
  req.destroy();

  req = net.connect(8006);
  req.write('PROXY\r\nasdasd');
  yield wait(100);
  req.destroy();

  req = https.get({
    host: '127.0.0.1',
    port: 8006,
    path: '/',
    agent: new https.Agent({rejectUnauthorized: false})
  });

  req.on('socket',cb = Cb());
  req.on('error',cb2 = Cb());

  (yield cb)[0].destroy();
  yield cb2;

  net.connect(8004,cb = Cb());
  yield (yield cb)[0];

  req = tls.connect({
    host: '127.0.0.1',
    port: 8107,
    rejectUnauthorized: false
  });

  req.on('error',cb = Cb());
  yield cb;

  req = https.get({
    host: '127.0.0.1',
    port: 8107,
    path: '/',
    agent: new https.Agent({rejectUnauthorized: false})
  });

  req.on('error',cb = Cb());
  yield cb;

  req = net.connect({
    host: '127.0.0.1',
    port: 8107
  },cb = Cb());

  req.write(new Buffer([22,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0]));
  yield (yield cb)[0];

  req = net.connect({
    host: '127.0.0.1',
    port: 8006
  },cb = Cb());

  req.write('\r\n12345');
  yield cb;

});
