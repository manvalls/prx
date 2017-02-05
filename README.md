# PRX
[![Build Status][ci-img]][ci-url] [![Coverage Status][cover-img]][cover-url]

PRX is a simple TCP reverse proxy with support for HAProxy's PROXY protocol versions 1 and 2 and out of the box host detection support for HTTP (including WebSockets) and TLS. For other types of streams, send the following string at the start of it for PRX to detect the host:

```
host: your.host.com\r\n\r\n
```

PRX's configuration is kept inside a RethinkDB server and can be updated at runtime. It consits of a list of rules with the following format:

```json
{
  "from": {
    "port": 80,
    "host": "your.host.com",
    "address": "0.0.0.0"
  },
  "to": {
    "port": 1234,
    "host": "77.231.239.251",
    "proxyProtocol": 1,
    "stripProxy": false,
    "stripHost": false,
    "prependHost": "foo.bar"
  }
}
```

If `address` is omitted PRX will listen on all network interfaces. When two or more rules match the same origin port, address and host, requests are randomly distributed according to rule's weight, with automatic failover in case a TCP connection can't be established. The `weight` property of the `to` block determines the rule's weight. It's an unsigned integer in the `[0-255]` range, `1` by default.

Wildcards are allowed in the `host` field, e.g `*.host.com`. If it's omitted the stream will be routed without trying to find host information, directly to specified backends. If `prependHost` is specified, a host string will be prepended to the stream, e.g `host: foo.bar\r\n`. If `stripHost` is set to `true`, the part of the stream used to find destination host will be stripped, i.e the first TLS packet or the host string.

`proxyProtocol` can be `1` or `2` depending on the desired PROXY protocol version. It can be omitted in order to disable the PROXY protocol header. If `stripProxy` is set to `true`, previously existing PROXY protocol headers will be stripped.

Note that by default TLS connections don't terminate on PRX and are routed instead to backend servers. You can force TLS decryption and encryption at PRX's side by adding the `tls` option to the `from` block, with the format expected by `tls.createSecureContext()`:

```json
{
  "from": {
    "port": 443,
    "host": "your.host.com",
    "tls": {
      "key": "...",
      "cert": "..."
    }
  },
  "to": {
    "port": 4321,
    "host": "127.0.0.1"
  }
}
```

You may also use string aliases, e.g:

```json
{
  "from": {
    "port": 80
  },
  "to": "backends"
}
```
```json
{
  "from": "backends",
  "to": {
    "port": 8081,
    "weight": 2
  }
}
```
```json
{
  "from": "backends",
  "to": {
    "port": 8082
  }
}
```

As long as a rule is found in the database PRX will try to connect to it when it needs to do so, with automatic failover, no matter how many times it has failed in the past. It is the user's duty to remove a rule from the database when it no longer applies. PRX's API is pretty simple:

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

Above shown are defaults. You can also use the command line utility, which will use node's `cluster` module:

```
sudo prx
```

Using `sudo` grants you permission to use ports `80` and `443`. It has the following RethinkDB options:

- `-p <port>`
- `-h <host>`
- `-db <database>`
- `-t <table>`
- `-usr <username>`
- `-pwd <password>`
- `-ca <CA file>`

All options are optional and have defaults whithin RethinkDB itself.

[ci-img]: https://circleci.com/gh/manvalls/prx.svg?style=shield
[ci-url]: https://circleci.com/gh/manvalls/prx
[cover-img]: https://coveralls.io/repos/manvalls/prx/badge.svg?branch=master&service=github
[cover-url]: https://coveralls.io/github/manvalls/prx?branch=master
