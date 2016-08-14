var t = require('u-test'),
    r = require('rethinkdb'),
    Prx = require('../../main.js'),
    fs = require('fs'),
    net = require('net'),
    https = require('https'),
    http = require('http'),
    Detacher = require('detacher');

exports.detachers = {
  servers: new Detacher(),
  prx: new Detacher()
};

exports.db = desc => t(desc,function*(){
  yield Prx.init();
});

exports.rules = desc => t(desc,function*(){
  var conn = yield r.connect('127.0.0.1');

  try{ yield r.db('prx').table('rules').insert([
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
        port: 9100,
        address: '127.0.0.1'
      },
      to: {
        port: 9002,
        proxyProtocol: 2
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
        port: 8104,
        host: '*.host.com',
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
        port: 8005,
        host: 'fake.com'
      },
      to: {
        port: 9999,
        host: '127.0.0.1'
      }
    },
    {
      from: {
        port: 8010,
        host: 'fake.com',
        tls: {foo: 'bar'}
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
    },
    {
      from: {
        host: 'sample.host.com',
        port: 8107,
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
  ]).run(conn); }
  finally{ conn.close(); }

});

exports.servers = desc => t(desc,function*(){
  var sampleHttp,sampleHttps,hostHttp,v2Net;

  exports.detachers.servers.add(
    v2Net = net.createServer(),
    sampleHttp = http.createServer(),
    hostHttp = http.createServer(),
    sampleHttps = https.createServer({
      key: fs.readFileSync(__dirname + '/key.pem'),
      cert: fs.readFileSync(__dirname + '/cert.pem')
    })
  );

  v2Net.listen(9002);
  sampleHttp.listen(8001);
  hostHttp.listen(8002);
  sampleHttps.listen(8003);

  v2Net.on('connection',function(socket){
    socket.end(
      'HTTP/1.1 200 OK\r\nDate: Mon, 23 May 2005 22:38:34 GMT\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Encoding: UTF-8\r\nContent-Length: 11\r\nLast-Modified: Wed, 08 Jan 2003 23:11:55 GMT\r\nConnection: close\r\n\r\nhello world'
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

});

exports.prx = desc => t(desc,function(){
  exports.detachers.prx.add(
    new Prx()
  );
});
