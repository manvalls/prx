var t = require('u-test'),
    assert = require('assert'),
    r = require('rethinkdb'),
    http = require('http'),
    https = require('https'),
    fs = require('fs'),
    proxiedHttp = require('findhit-proxywrap').proxy(http),
    wait = require('y-timers/wait'),
    Cb = require('y-callback'),
    Prx = require('../main.js');

t('Main tests',function*(){
  var conn = yield r.connect('127.0.0.1'),
      prx,cb;

  try{ yield r.db('prx').tableDrop('rules').run(conn); }
  catch(e){ }

  yield Prx.init();
  prx = new Prx();

  yield r.db('prx').table('rules').insert([
    {
      from: {
        port: 8004,
        host: '*.host.com'
      },
      to: {
        port: 8005,
        proxyProtocol: 1,
        host: '127.0.0.1'
      }
    },
    {
      from: {
        port: 8005,
        host: 'host.com'
      },
      to: {
        port: 8002,
        host: '127.0.0.1'
      }
    },
    {
      from: {
        port: 8005,
        host: 'sample.host.com'
      },
      to: {
        port: 8001,
        host: '127.0.0.1'
      }
    },
    {
      from: {
        port: 8006,
        host: 'sample.host.com'
      },
      to: {
        port: 8003,
        host: '127.0.0.1'
      }
    }
  ]).run(conn);

  sampleHttp = proxiedHttp.createServer();
  hostHttp = proxiedHttp.createServer();
  sampleHttps = https.createServer({
    key: fs.readFileSync(__dirname + '/key.pem'),
    cert: fs.readFileSync(__dirname + '/cert.pem')
  });

  sampleHttp.listen(8001);
  hostHttp.listen(8002);
  sampleHttps.listen(8003);

  sampleHttp.on('request',function(req,res){
    res.end('sample');
  });

  hostHttp.on('request',function(req,res){
    res.end('host');
  });

  sampleHttps.on('request',function(req,res){
    res.end('sample');
  });

  yield wait(1000);

  http.get('http://sample.host.com:8004/',cb = Cb());
  assert.equal(yield (yield cb)[0],'sample');

  http.get('http://host.com:8004/',cb = Cb());
  assert.equal(yield (yield cb)[0],'host');

  https.get({
    host: 'sample.host.com',
    port: 8006,
    path: '/',
    agent: new https.Agent({rejectUnauthorized: false})
  },cb = Cb());

  assert.equal(yield (yield cb)[0],'sample');

  try{ yield r.db('prx').table('rules').delete().run(conn); }
  catch(e){ }

  yield r.db('prx').table('rules').insert([
    {
      from: {
        port: 8004,
        host: '*.host.com'
      },
      to: {
        port: 8005,
        proxyProtocol: 1,
        host: '127.0.0.1'
      }
    },
    {
      from: {
        port: 8005,
        host: 'host.com'
      },
      to: {
        port: 8002,
        host: '127.0.0.1'
      }
    },
    {
      from: {
        port: 8005,
        host: 'sample.host.com'
      },
      to: {
        port: 8001,
        host: '127.0.0.1'
      }
    },
    {
      from: {
        port: 8006,
        host: 'sample.host.com'
      },
      to: {
        port: 8003,
        host: '127.0.0.1'
      }
    }
  ]).run(conn);

  conn.close();
  yield wait(1000);

  http.get('http://sample.host.com:8004/',cb = Cb());
  assert.equal(yield (yield cb)[0],'sample');

  http.get('http://host.com:8004/',cb = Cb());
  assert.equal(yield (yield cb)[0],'host');

  https.get({
    host: 'sample.host.com',
    port: 8006,
    path: '/',
    agent: new https.Agent({rejectUnauthorized: false})
  },cb = Cb());

  assert.equal(yield (yield cb)[0],'sample');

  prx.detach();
  sampleHttp.close();
  hostHttp.close();
  sampleHttps.close();

});
