#!/usr/bin/env node
var cluster = require('cluster'),
    walk = require('y-walk'),
    Prx = require('./main.js');

if(cluster.isMaster) walk(function*(){
  var cpus = require('os').cpus().length;

  try{
    yield Prx.init();
  }catch(e){
    console.error('Could not connect to RethinkDB');
    process.exit(1);
    return;
  }

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
else new Prx();
