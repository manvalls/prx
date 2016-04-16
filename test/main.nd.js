var t = require('u-test'),
    assert = require('assert'),
    r = require('rethinkdb'),
    http = require('http'),
    net = require('net'),
    https = require('https'),
    fs = require('fs'),
    wait = require('y-timers/wait'),
    Cb = require('y-callback'),
    Prx = require('../main.js');

t('Main tests',function*(){
  var conn = yield r.connect('127.0.0.1'),
      prx,cb,sampleHttp,sampleHttps,hostHttp,v2Net;

  try{ yield r.db('prx').tableDrop('rules').run(conn); }
  catch(e){ }

  yield Prx.init();
  prx = new Prx();

  yield r.db('prx').table('rules').insert([
    {
      from: {
        port: 9000,
        host: '*.v2.host.com'
      },
      to: {
        port: 9001,
        proxyProtocol: 2,
        host: '127.0.0.1'
      }
    },
    {
      from: {
        port: 9001,
        host: 'test.v2.host.com'
      },
      to: {
        port: 9002,
        host: '127.0.0.1'
      }
    },
    {
      from: {
        port: 9003
      },
      to: {
        port: 9004,
        host: '127.0.0.1',
        prependHost: 'sample.host.com'
      }
    },
    {
      from: {
        port: 9004,
        host: 'sample.host.com',
        address: '127.0.0.1'
      },
      to: {
        port: 8001,
        host: '127.0.0.1',
        stripHost: true
      }
    },
    {
      from: {
        port: 8004,
        host: '*.host.com',
        address: '127.0.0.1'
      },
      to: {
        port: 8005,
        proxyProtocol: 1,
        host: '127.0.0.1'
      }
    },
    {
      from: {
        port: 8004,
        host: '*.host.com',
        address: '127.0.0.1'
      },
      to: {
        port: 8800,
        proxyProtocol: 2,
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
        host: '127.0.0.1',
        stripProxy: true
      }
    },
    {
      from: {
        port: 8005,
        host: 'sample.host.com'
      },
      to: {
        port: 8001,
        host: '127.0.0.1',
        stripProxy: true
      }
    },
    {
      from: {
        port: 8006,
        host: '*'
      },
      to: {
        port: 8003,
        host: '127.0.0.1'
      }
    },
    {
      from: {
        port: 8007,
        tls: {
          key: fs.readFileSync(__dirname + '/key.pem').toString(),
          cert: fs.readFileSync(__dirname + '/cert.pem').toString()
        }
      },
      to: {
        port: 8001,
        host: '127.0.0.1'
      }
    }
  ]).run(conn);

  v2Net = net.createServer();
  sampleHttp = http.createServer();
  hostHttp = http.createServer();
  sampleHttps = https.createServer({
    key: fs.readFileSync(__dirname + '/key.pem'),
    cert: fs.readFileSync(__dirname + '/cert.pem')
  });

  v2Net.listen(9002);
  sampleHttp.listen(8001);
  hostHttp.listen(8002);
  sampleHttps.listen(8003);

  v2Net.on('connection',function(socket){
    socket.end(
`HTTP/1.1 200 OK\r
Date: Mon, 23 May 2005 22:38:34 GMT\r
Content-Type: text/html; charset=UTF-8\r
Content-Encoding: UTF-8\r
Content-Length: 11\r
Last-Modified: Wed, 08 Jan 2003 23:11:55 GMT\r
Connection: close\r
\r
hello world`
    );
  });

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

  http.get('http://test.v2.host.com:9000/',cb = Cb());
  assert.equal(yield (yield cb)[0],'hello world');

  http.get('http://sample.host.com:8004/',cb = Cb());
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
    port: 8007,
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
        host: '127.0.0.1',
        stripProxy: true
      }
    },
    {
      from: {
        port: 8005,
        host: 'sample.host.com'
      },
      to: {
        port: 8001,
        host: '127.0.0.1',
        stripProxy: true
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
    },
    {
      from: {
        port: 8007,
        host: 'sample.host.com',
        tls: {
          key: fs.readFileSync(__dirname + '/key.pem').toString(),
          cert: fs.readFileSync(__dirname + '/cert.pem').toString()
        }
      },
      to: {
        port: 8001,
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

  https.get({
    host: 'sample.host.com',
    port: 8007,
    path: '/',
    agent: new https.Agent({rejectUnauthorized: false})
  },cb = Cb());

  assert.equal(yield (yield cb)[0],'sample');

  prx.detach();
  v2Net.close();
  sampleHttp.close();
  hostHttp.close();
  sampleHttps.close();

});
