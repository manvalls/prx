/**/ 'use strict' /**/
var r = require('rethinkdb'),
    walk = require('y-walk'),
    net = require('net'),
    tls = require('tls'),
    Cb = require('y-callback'),
    proxyProtocol = require('./main/proxyProtocol.js'),
    bindServer = require('./main/bindServer.js'),
    injectXFH = require('./main/injectXFH.js'),
    otherSocket = Symbol(),
    connection = Symbol(),
    walker = Symbol(),
    servers = Symbol(),
    feed = Symbol(),
    buff = new Buffer(1),
    getDest;

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
  opt.tls = opt.tls || {};
  return opt;
}

function* processPrx(prx,host,opt){
  var rules = {},
      aliases = {},
      srv = prx[servers],
      conn,cursor,change,events,a,h,
      rule,oldRule,oldHost,i,key,w;

  opt = fillOpt(opt);

  while(true) try{
    prx[connection] = conn = yield r.connect(host || '127.0.0.1');
    conn.on('error',noop);
    conn.use(opt.database);

    prx[feed] = cursor = yield r.table(opt.tables.rules).changes({includeInitial: true}).run(conn);

    while(true){

      change = yield cursor.next();
      oldRule = null;
      oldHost = null;

      if(change.old_val){

        change.old_val.from = change.old_val.from || '';
        change.old_val.to = change.old_val.to || '';

        if(typeof change.old_val.from == 'string'){

          if(a = aliases[change.old_val.from]){
            i = a.findIndex(find,change.old_val);
            while(i != -1){
              a.splice(i,1);
              if(!a.length) delete aliases[change.old_val.from];
              i = a.findIndex(find,change.old_val);
            }
          }

        }else{

          key = (change.old_val.from.address || '') + ':' + (change.old_val.from.port || 0);

          oldRule = rules[key];
          if(oldRule && (oldHost = oldRule.hosts[change.old_val.from.host || ''])){
            i = oldHost.backends.findIndex(find,change.old_val);
            while(i != -1){
              oldHost.backends.splice(i,1);
              i = oldHost.backends.findIndex(find,change.old_val);
            }
          }

        }

      }

      if(change.new_val){

        change.new_val.from = change.new_val.from || '';
        change.new_val.to = change.new_val.to || '';

        if(typeof change.new_val.from == 'string'){

          if(typeof change.new_val.to == 'object'){
            buff[0] = 'weight' in change.new_val.to ? change.new_val.to.weight : 1;
            w = buff[0];
          }else w = 1;

          a = aliases[change.new_val.from] = aliases[change.new_val.from] || [];
          for(i = 0;i < w;i++) a.push(change.new_val);

        }else{

          key = (change.new_val.from.address || '') + ':' + (change.new_val.from.port || 0);

          if(!rules[key]){
            rules[key] = rule = {key: key};
            rule.server = net.createServer();

            if(change.new_val.from.address) rule.server.listen(
              change.new_val.from.port || 0,
              change.new_val.from.address
            );
            else rule.server.listen(change.new_val.from.port || 0);

            events = {};
            rule.server.once('listening',events.listening = Cb());
            rule.server.once('close',events.close = Cb());
            rule.server.once('error',events.error = Cb());

            events = yield events;
            if(!('listening' in events)) continue;

            rule.hosts = {};
            srv.add(rule.server);
            bindServer(rule.server,rule.hosts).on('connection',proxy,rule.hosts,rule.server,aliases);
          }else rule = rules[key];

          if(typeof change.new_val.to == 'object'){
            buff[0] = 'weight' in change.new_val.to ? change.new_val.to.weight : 1;
            w = buff[0];
          }else w = 1;

          h = rule.hosts[change.new_val.from.host || ''] = rule.hosts[change.new_val.from.host || ''] || {
            backends: [],
            host: change.new_val.from.host || ''
          };

          if(change.new_val.from.tls) for(key of Object.keys(opt.tls)) if(!(key in change.new_val.from.tls)){
            change.new_val.from.tls[key] = opt.tls[key];
          }

          for(i = 0;i < w;i++) h.backends.push(change.new_val);

        }

      }

      if(oldHost && !oldHost.backends.length){
        delete oldRule.hosts[oldHost.host || ''];
        if(!Object.keys(oldRule.hosts).length){
          delete rules[oldRule.key];
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

function noop(){}

function find(backend){
  return backend.id == this.id;
}

function* proxy(e,d,hosts,server,aliases){
  var parts,target,backend,
      host,dest,socket;

  socket = e.socket;

  if(hosts[e.host || '']) target = hosts[e.host || ''];
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

  dest = yield getDest(target.backends,aliases);

  if(!dest){
    e.socket.destroy();
    return;
  }

  try{
    if(!dest.to.stripHost) e.socket.unshift(e.hostHeader);
  }catch(err){
    dest.socket.destroy();
    return;
  }

  if(dest.from.tls){

    try{

      e.socket = new tls.TLSSocket(e.socket,{
        secureContext: tls.createSecureContext(dest.from.tls),
        isServer: true
      });

    }catch(err){
      dest.socket.destroy();
      e.socket.destroy();
      return;
    }

  }

  switch(dest.to.proxyProtocol){

    case 1:
      proxyProtocol.v1(e.socket,dest.socket);
      break;

    case 2:
      proxyProtocol.v2(e.socket,dest.socket);
      break;

  }

  if(!dest.to.stripProxy) dest.socket.write(e.proxyHeader);
  if(dest.to.prependHost) dest.socket.write('host: ' + dest.to.prependHost + '\r\n');

  if(dest.to.XFH){
    try{
      yield injectXFH(socket,e.socket,dest.socket);
    }catch(err){
      dest.socket.destroy();
      e.socket.destroy();
      return;
    }
  }

  dest.socket.pipe(e.socket).pipe(dest.socket);
  dest.socket[otherSocket] = e.socket;
  e.socket[otherSocket] = dest.socket;

  dest.socket.on('close',onError);
  e.socket.on('close',onError);
  dest.socket.on('error',onError);
  e.socket.on('error',onError);

}

getDest = walk.wrap(function*(backends,aliases){
  var backend,dest,socket,events;

  for(backend of shuffle(backends)){

    if(typeof backend.to == 'string'){

      dest = yield getDest(aliases[backend.to] || [],aliases);
      if(dest){
        dest.from = backend.from;
        return dest;
      }

    }else{

      if(backend.to.host) socket = net.connect(backend.to.port,backend.to.host);
      else socket = net.connect(backend.to.port);
      events = {};

      socket.once('connect',events.connect = Cb());
      socket.once('error',events.error = Cb());
      socket.once('close',events.close = Cb());

      events = yield events;
      if('connect' in events) break;
      socket = null;

    }

  }

  if(socket){
    dest = {};
    dest.to = backend.to;
    dest.from = backend.from;
    dest.socket = socket;
    return dest;
  }

});

function* shuffle(array){
  var i,j,temp,rand;

  array = array.slice();

  for(j = 0;j < 3;j++){

    i = array.length;
    while(i != 0){
      rand = Math.floor(Math.random() * i);
      i--;

      temp = array[rand];
      array[rand] = array[i];
      array[i] = temp;

      yield temp;
    }

  }

}

function onError(err){
  this.destroy();
  this[otherSocket].destroy();
}

/*/ exports /*/

module.exports = Prx;
