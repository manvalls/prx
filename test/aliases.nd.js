var t = require('u-test'),
    assert = require('assert'),
    r = require('rethinkdb'),
    http = require('http'),
    wait = require('y-timers/wait'),
    Cb = require('y-callback'),
    Prx = require('../main.js');

t('Aliases',function*(){
  var conn = yield r.connect('127.0.0.1'),
      prx,s1,s2,s3,i,cb;

  try{ yield r.db('prx').tableDrop('rules').run(conn); }
  catch(e){ }

  yield Prx.init();
  prx = new Prx();

  yield r.db('prx').table('rules').insert([
    {
      from: {
        port: 8888
      },
      to: 'test'
    },
    {
      from: 'test',
      to: 'test2'
    },
    {
      from: 'test2',
      to: 'gateway'
    },
    {
      from: 'gateway',
      to: {
        port: 8081,
        weight: 5
      }
    },
    {
      from: 'gateway',
      to: {
        port: 8082,
        weight: 4
      }
    },
    {
      from: 'test',
      to: {
        port: 8082,
        weight: 1
      }
    },
    {
      from: 'gateway',
      to: {
        port: 8083,
        weight: 0
      }
    }
  ]).run(conn);

  s1 = http.createServer().listen(8081);
  s2 = http.createServer().listen(8082);
  s3 = http.createServer().listen(8083);

  s1.on('request',(req,res) => res.end('hi'));
  s2.on('request',(req,res) => res.end('hi'));
  s3.on('request',(req,res) => res.end('ho'));

  yield wait(500);

  for(i = 0;i < 20;i++){
    http.get('http://127.0.0.1:8888/',cb = Cb());
    assert.equal(yield (yield cb)[0],'hi');
  }

  s1.close();
  s2.close();

  try{ yield r.db('prx').table('rules').delete().run(conn); }
  catch(e){ }

  yield r.db('prx').table('rules').insert([
    {
      from: {
        port: 8888
      },
      to: 'test'
    },
    {
      from: 'test',
      to: 'test2'
    },
    {
      from: 'test2',
      to: 'gateway'
    },
    {
      from: 'gateway',
      to: {
        port: 8083,
        weight: 1
      }
    }
  ]).run(conn);

  yield wait(500);

  for(i = 0;i < 20;i++){
    http.get('http://127.0.0.1:8888/',cb = Cb());
    assert.equal(yield (yield cb)[0],'ho');
  }

  prx.detach();
  s3.close();
  conn.close();

});
