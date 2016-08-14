var t = require('u-test'),
    assert = require('assert'),
    r = require('rethinkdb'),
    http = require('http'),
    net = require('net'),
    https = require('https'),
    fs = require('fs'),
    wait = require('y-timers/wait'),
    Cb = require('y-callback'),
    init = require('./main/init'),
    clean = require('./main/clean'),
    Prx = require('../main.js'),
    requests = require('./main/requests'),
    errors = require('./main/errors');

t('Main tests',function*(){
  var tests = () => [
        requests('Regular requests (1)'),
        requests('Regular requests (2)'),
        requests('Regular requests (3)'),
        errors('Evil requests (1)'),
        errors('Evil requests (2)'),
        errors('Evil requests (3)')
      ],
      cb,cb2,req;

  yield clean.db('Clean DB');
  yield init.db('Init DB');
  yield init.rules('Init rules (1)');
  yield init.servers('Init servers');
  yield init.prx('Init PRX');
  yield wait(500);

  yield tests();

  yield clean.rules('Clean rules (2)');
  yield init.rules('Init rules (2)');
  yield wait(500);

  yield tests();

  clean.servers('Clean servers');
  clean.prx('Clean prx');

});
