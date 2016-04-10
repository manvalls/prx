# PRX [![Build Status][ci-img]][ci-url] [![Coverage Status][cover-img]][cover-url]

PRX is a simple TCP reverse proxy with support for HAProxy's PROXY protocol versions 1 and 2 and out of the box support for HTTP (including WebSockets) and TLS with SNI. For other types of streams, send the following string either at the start of it or after a CRLF:

```
host: your.host.com\r\n
```

PRX's configuration is kept inside a RethinkDB server and can be updated at runtime. It consits of a list of rules with the following format:

```json
{
  "from": {
    "port": 80,
    "host": "your.host.com"
  },
  "to": {
    "port": 1234,
    "host": "127.0.0.1",
    "proxyProtocol": 1
  }
}
```

Wildcards are allowed in the `host` field, e.g `*.host.com`. `proxyProtocol` can be `1` or `2` depending on the desired PROXY protocol version. It can be omitted in order to disable the PROXY protocol header. When two or more rules match the same origin port and host round robin applies, with automatic failover in case a TCP connection can't be established.

As long as a rule is found in the database PRX will try to connect to it when it needs to do so, no matter how many times it has failed in the past. It is the user's duty to remove a rule from the database when it no longer applies. PRX's API is pretty simple:

```javascript
var Prx = require('prx'),
    prx = new Prx(/* rethinkdbHost, options */);

// To stop the proxy

prx.detach();
```

`rethinkdbHost` is the host of the RethinkDB server, `127.0.0.1` by default. See `r.connect()` for more options. `options` is an optional object with the following structure:

```json
{
  "database": "prx",
  "tables": {
    "rules": "rules"
  }
}
```

Above shown are defaults. You can also use the command line utility, which will use the default options and node's `cluster` module:

```
sudo prx
```

Using `sudo` grants you permission to use ports `80` and `443`.

[ci-img]: https://circleci.com/gh/manvalls/prx.svg?style=shield
[ci-url]: https://circleci.com/gh/manvalls/prx
[cover-img]: https://coveralls.io/repos/manvalls/prx/badge.svg?branch=master&service=github
[cover-url]: https://coveralls.io/github/manvalls/prx?branch=master
