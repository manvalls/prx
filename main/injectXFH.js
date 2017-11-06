var walk = require('y-walk'),
    ip = require('ip'),
    read = require('./read');

module.exports = walk.wrap(function*(originalSocket,socketFrom,socketTo){
  var sequence = [0x0d, 0x0a, 0x0d, 0x0a],
      i,j,b;

  loop: while(true){

    for(i = 0;i < sequence.length;i++){
      b = yield read(socketFrom, 1);

      if(b[0] != sequence[i]){
        socketTo.write(new Buffer(sequence.slice(0,i)));
        socketTo.write(b);
        continue loop;
      }
    }

    socketTo.write(new Buffer(sequence.slice(0,2)));
    socketTo.write(`X-Forwarded-For: ${ip.toString(ip.toBuffer(originalSocket.remoteAddress))}\r\n`);
    if(originalSocket != socketFrom)
      socketTo.write('X-Forwarded-Proto: https\r\n');
    socketTo.write(new Buffer(sequence.slice(2,4)));
    return;

  }

});
