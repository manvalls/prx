#!/usr/bin/env node
var cluster = require('cluster'),
    walk = require('y-walk'),
    fs = require('fs'),
    Prx = require('./main.js'),
    cas = [],
    i,host,port,table,db,user,password,
    ca,opt;

for(i = 0;i < process.argv.length;i++) switch(process.argv[i]){

  case '-h':
    host = process.argv[++i];
    break;

  case '-t':
    table = process.argv[++i];
    break;

  case '-db':
    db = process.argv[++i];
    break;

  case '-p':
    port = process.argv[++i];
    break;

  case '-usr':
    user = process.argv[++i];
    break;

  case '-pwd':
    password = process.argv[++i];
    break;

  case '-ca':
    cas.push(process.argv[++i]);
    break;

}

host = host || '127.0.0.1';
port = port || 28015;
user = user || 'admin';
password = password || '';
db = db || 'prx';
table = table || 'rules';

opt = {};
opt.host = host;
opt.port = port;
opt.user = user;
opt.password = password;
opt.db = db;

if(cas.length){
  opt.ssl = {ca: []};
  for(ca of cas) opt.ssl.ca.push(fs.readFileSync(ca));
}


if(cluster.isMaster) walk(function*(){
  var cpus = require('os').cpus().length;

  console.log(`\n\n\t╒══╡ PRX v${require('./package.json').version} ╞══╕\n`);

  console.log(' RethinkDB options:');
  console.log(`  host (-h)\t\t${host}`);
  console.log(`  port (-p)\t\t${port}`);
  console.log(`  database (-db)\t${db}`);
  console.log(`  table (-t)\t\t${table}`);
  console.log(`  user (-usr)\t\t${user}`);
  console.log(`  password (-pwd)\t${password.replace(/[^]/g,'*')}`);

  if(cas.length) for(ca of cas){
    console.log(`  CA (-ca)\t\t${ca}`);
  }

  console.log('\n');

  try{

    yield Prx.init(opt,{
      database: db,
      tables: {
        rules: table
      }
    });

  }catch(e){
    console.error('ERROR: Could not connect to RethinkDB\n');
    process.exit(1);
    return;
  }

  cluster.on('disconnect',function(worker){
    console.log(`Worker ${worker.id} offline`);
  });

  cluster.on('online',function(worker){
    console.log(`Worker ${worker.id} online`);
  });

  cluster.on('listening',function(worker,address){
    console.log(`Worker ${worker.id} listening on ${address.address || ''}:${address.port}`);
  });

  function checkWorkers(){
    var remaining = cpus - Object.keys(cluster.workers).length,
        child;

    while(remaining > 0){
      remaining--;
      child = cluster.fork();
      child.on('error',checkWorkers);
      child.on('exit',checkWorkers);
    }

  }

  checkWorkers();

});
else new Prx(opt,{
  database: db,
  tables: {
    rules: table
  }
});
