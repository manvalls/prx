var t = require('u-test'),
    r = require('rethinkdb'),
    init = require('./init.js'),
    Detacher = require('detacher');

exports.db = desc => t(desc,function*(){
  var conn = yield r.connect('127.0.0.1');

  try{ yield r.db('prx').tableDrop('rules').run(conn); }
  catch(e){ }
  conn.close();

});

exports.rules = desc => t(desc,function*(){
  var conn = yield r.connect('127.0.0.1');

  try{ yield r.db('prx').table('rules').delete().run(conn); }
  catch(e){ }
  conn.close();

});

exports.servers = desc => t(desc,function*(){
  init.detachers.servers.detach();
  init.detachers.servers = new Detacher();
});

exports.prx = desc => t(desc,function*(){
  init.detachers.prx.detach();
  init.detachers.prx = new Detacher();
});
