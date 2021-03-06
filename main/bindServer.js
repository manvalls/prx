var Emitter = require('y-emitter'),
    walk = require('y-walk'),
    read = require('./read'),
    emitter = Symbol(),
    hostsMap = Symbol(),
    processSocket,read;

function bindServer(server,hosts){
  var em = new Emitter();

  server[hostsMap] = hosts;
  server[emitter] = em;
  server.on('connection',onConnection);
  return em.target;
}

function onConnection(socket){
  var em = this[emitter],
      hosts = this[hostsMap];

  if(hosts['']){

    em.give('connection',{
      socket: socket,
      host: '',
      proxyHeader: new Buffer(0),
      hostHeader: new Buffer(0)
    });

    return;
  }

  processSocket(socket,em);
  socket.setTimeout(1000);

  socket.on('error',onError);
  socket.on('timeout',onError);
  socket.on('close',onError);
  socket.on('end',onError);
}

function onError(){
  detach(this);
  this.destroy();
}

function detach(socket){
  socket.removeListener('error',onError);
  socket.removeListener('timeout',onError);
  socket.removeListener('close',onError);
  socket.removeListener('end',onError);
  socket.setTimeout(0);
  socket.pause();
}

processSocket = walk.wrap(function*(socket,emitter){
  var queue = [],
      proxy = [],
      b,pb,line,m,host,
      i,length;

  while(true){

    b = yield read(socket,5);
    proxy.push(b);

    if(b.toString() == 'PROXY'){

      // PROXY protocol version 1

      do{
        b = yield read(socket,1);
        proxy.push(b);
      }while(b[0] != 0x0d);

      proxy.push(yield read(socket,1));

    }else if(b.toString('hex') == '0d0a0d0a00'){

      // PROXY protocol version 2

      proxy.push(yield read(socket,9));
      b = yield read(socket,2);
      proxy.push(b);
      proxy.push(yield read(socket,b.readUInt16BE(0)));

    }else break;

  }

  queue.push(proxy.pop());

  if(b[0] == 22){

    // TLS

    try{

      // type: 1 byte
      // version: 2 bytes
      // length: 2 bytes

      length = b.readUInt16BE(3);
      b = yield read(socket,length);
      queue.push(b);
      i = 0;

      // msg_type: 1 byte
      // length: 3 bytes
      // client_version: 2 bytes
      // random: 32 bytes

      if(b.readUInt8(i) != 1) throw new Error();
      i+=38;

      // session_id

      i += 1 + b.readUInt8(i);

      // cipher_suites

      i += 2 + b.readUInt16BE(i);

      // compression_methods

      i += 1 + b.readUInt8(i);

      // extensions

      i += 2;
      while(true){

        if(b.readInt16BE(i) == 0){
          i += 7;
          host = b.slice(i + 2,i + 2 + b.readUInt16BE(i)).toString().trim().toLowerCase();
          break;
        }

        i += 4 + b.readUInt16BE(i + 2);

      }

    }catch(e){ host = ''; }

  }else{

    // HTTP-like

    i = 0;
    queue.pop();
    line = [];
    socket.unshift(b);

    while(true){

      b = yield read(socket,1);
      while(b[0] != 0x0d){
        line.push(b);
        b = yield read(socket,1);
      }

      line = Buffer.concat(line);
      queue.push(line);
      queue.push(b);
      queue.push(yield read(socket,1));

      line = line.toString().trim().toLowerCase();

      if(
        (m = line.match(/^host:\s*([a-z0-9\-._~!$&'()*+,;=%]*?)(:\d*)?$/)) &&
        !m[1].match(/^\d+\.\d+\.\d+\.\d+$/)
      ){
        host = m[1];
        break;
      }

      line = [];

    }

  }

  detach(socket);
  b = Buffer.concat(queue);
  pb = Buffer.concat(proxy);

  emitter.give('connection',{
    socket: socket,
    host: host,
    proxyHeader: pb,
    hostHeader: b
  });

});

/*/ exports /*/

module.exports = bindServer;
