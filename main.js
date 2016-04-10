/**/ 'use strict' /**/
var r = require('rethinkdb'),
    walk = require('y-walk'),
    net = require('net'),
    Cb = require('y-callback'),
    proxyProtocol = require('./main/proxyProtocol.js'),
    bindServer = require('./main/bindServer.js'),
    otherSocket = Symbol(),
    connection = Symbol(),
    walker = Symbol(),
    servers = Symbol(),
    feed = Symbol();

class Prx{

  constructor(host,opt){
    this[servers] = new Set();
    this[walker] = walk(processPrx,[this,host,opt]);
  }

  detach(){
    var server;

    this[walker].pause();
    if(this[feed]) this[feed].close();
    if(this[connection]) this[connection].close();
    for(server of this[servers]) server.close();
  }

  static init(host,opt){
    opt = fillOpt(opt);
    return walk(init,[host,opt]);
  }

}

function* init(host,opt){
  var conn = yield r.connect(host || '127.0.0.1');

  try{ yield r.dbCreate(opt.database).run(conn); }
  catch(e){ }

  try{ yield r.db(opt.database).tableCreate(opt.tables.rules,{primaryKey: 'id'}).run(conn); }
  catch(e){ }

  conn.close();
}

function fillOpt(opt){
  opt = opt || {};
  opt.database = opt.database || 'prx';
  opt.tables = opt.tables || {};
  opt.tables.rules = opt.tables.rules || 'rules';
  return opt;
}

function* processPrx(prx,host,opt){
  var rules = {},
      srv = prx[servers],
      conn,cursor,change,events,
      rule,oldRule,oldHost,i;

  opt = fillOpt(opt);

  while(true) try{
    prx[connection] = conn = yield r.connect(host || '127.0.0.1');
    conn.use(opt.database);

    prx[feed] = cursor = yield r.table(opt.tables.rules).changes({includeInitial: true}).run(conn);

    while(true){

      change = yield cursor.next();
      oldRule = null;
      oldHost = null;

      if(change.old_val){

        change.old_val.from = change.old_val.from || {};
        change.old_val.to = change.old_val.to || {};

        oldRule = rules[change.old_val.from.port || 0];
        if(oldRule && (oldHost = oldRule.hosts[change.old_val.from.host])){
          i = oldHost.backends.findIndex(find,change.old_val);
          if(i != -1) oldHost.backends.splice(i,1);
        }
      }

      if(change.new_val){

        change.new_val.from = change.new_val.from || {};
        change.new_val.to = change.new_val.to || {};

        if(!rules[change.new_val.from.port || 0]){
          rules[change.new_val.from.port || 0] = rule = {port: change.new_val.from.port || 0};
          rule.server = net.createServer().listen(change.new_val.from.port || 0);

          events = {};
          rule.server.once('listening',events.listening = Cb());
          rule.server.once('close',events.close = Cb());
          rule.server.once('error',events.error = Cb());

          events = yield events;
          if(!('listening' in events)) continue;

          srv.add(rule.server);
          bindServer(rule.server).on('connection',proxy,rule.hosts = {});
        }else rule = rules[change.new_val.from.port || 0];

        rule.hosts[change.new_val.from.host] = rule.hosts[change.new_val.from.host] || {
          backends: [],
          host: change.new_val.from.host
        };

        rule.hosts[change.new_val.from.host].backends.push(change.new_val);

      }

      if(oldHost && !oldHost.backends.length){
        delete oldRule.hosts[oldHost.host];
        if(!Object.keys(oldRule.hosts).length){
          delete rules[oldRule.port];
          srv.delete(oldRule.server);
          oldRule.server.close();
        }
      }

    }

  }catch(e){
    try{ conn.close(); }
    catch(e){ }
  }

}

function find(backend){
  return backend.id == this.id;
}

function* proxy(e,d,hosts){
  var parts,target,backend,
      host,socket,events;

  if(hosts[e.host]) target = hosts[e.host];
  else{

    parts = e.host.split('.');

    do{
      host = ['*'].concat(parts).join('.');
      target = hosts[host];
      if(target) break;
    }while(parts.shift());

  }

  if(!(target && target.backends.length)){
    e.socket.destroy();
    return;
  }

  target.backends.push(target.backends.shift());

  for(backend of target.backends){
    if(!backend.to) continue;
    socket = net.connect(backend.to.port,backend.to.host);
    events = {};

    socket.once('connect',events.connect = Cb());
    socket.once('error',events.error = Cb());
    socket.once('close',events.close = Cb());

    events = yield events;
    if('connect' in events) break;
    socket = null;
  }

  if(!socket){
    e.socket.destroy();
    return;
  }

  switch(backend.to.proxyProtocol){

    case 1:
      proxyProtocol.v1(e.socket,socket);
      break;

    case 2:
      proxyProtocol.v2(e.socket,socket);
      break;

  }

  socket.pipe(e.socket).pipe(socket);
  socket[otherSocket] = e.socket;
  e.socket[otherSocket] = socket;

  socket.on('error',onError);
  e.socket.on('error',onError);

}

function onError(err){
  this.destroy();
  this[otherSocket].destroy();
}

/*/ exports /*/

module.exports = Prx;
