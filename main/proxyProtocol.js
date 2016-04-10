var ip = require('ip');

exports.v1 = function(fromSocket,toSocket){
  var protocol,sourceAddr,destAddr,
      sourcePort,destPort;

  switch(fromSocket.address().family){

    case 'IPv4':
      protocol = 'TCP4';
      break;

    case 'IPv6':
      protocol = 'TCP6';
      break;

    default:
      protocol = 'UNKNOWN';
      break;

  }

  sourceAddr = ip.toString(ip.toBuffer(fromSocket.remoteAddress));
  sourcePort = fromSocket.remotePort;
  destAddr = ip.toString(ip.toBuffer(fromSocket.address().address));
  destPort = fromSocket.address().port;

  toSocket.write(`PROXY ${protocol} ${sourceAddr} ${destAddr} ${sourcePort} ${destPort}\r\n`);
};

exports.v2 = function(fromSocket,toSocket){
  var addresses = [],
      b;

  toSocket.write(new Buffer([0x0D,0x0A,0x0D,0x0A,0x00,0x0D,0x0A,0x51,0x55,0x49,0x54,0x0A,0x21]));

  switch(fromSocket.address().family){

    case 'IPv4':
      toSocket.write(new Buffer([0x11]));
      break;

    case 'IPv6':
      toSocket.write(new Buffer([0x21]));
      break;

    default:
      toSocket.write(new Buffer([0x01]));
      break;

  }

  try{

    addresses.push(ip.toBuffer(fromSocket.remoteAddress));
    addresses.push(ip.toBuffer(fromSocket.address().address));

    b = new Buffer(2);
    b.writeUInt16BE(fromSocket.remotePort,0);
    addresses.push(b);

    b = new Buffer(2);
    b.writeUInt16BE(fromSocket.address().port,0);
    addresses.push(b);

    addresses = Buffer.concat(addresses);

  }catch(e){
    addresses = new Buffer(0);
  }

  b = new Buffer(2);
  b.writeUInt16BE(addresses.length,0);
  toSocket.write(b);

  toSocket.write(addresses);

};
