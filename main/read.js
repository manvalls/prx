var walk = require('y-walk'),
    Cb = require('y-callback');

module.exports = walk.wrap(function*(socket,n){
  var cb,data;

  while(true){
    data = socket.read(n);
    if(data) return data;
    socket.once('readable',cb = Cb());
    yield cb;
  }

});
