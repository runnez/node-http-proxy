/*
  standalone-proxy.js: Example of proxying over HTTP with a standalone HTTP server.

  Copyright (c) 2013 - 2016 Charlie Robbins, Jarrett Cruger & the Contributors.

  Permission is hereby granted, free of charge, to any person obtaining
  a copy of this software and associated documentation files (the
  "Software"), to deal in the Software without restriction, including
  without limitation the rights to use, copy, modify, merge, publish,
  distribute, sublicense, and/or sell copies of the Software, and to
  permit persons to whom the Software is furnished to do so, subject to
  the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
  LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
  OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
  WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

import { styleText } from 'node:util';
import http from 'node:http';
import httpProxy from '../../dist/http-proxy.js';

//
// Http Server with proxyRequest Handler and Latency
//
const proxy = httpProxy.createProxyServer();
http.createServer((req, res) => {
  setTimeout(() => {
    proxy.web(req, res, {
      target: 'http://localhost:9002'
    });
  }, 200);
}).listen(8002);

//
// Target Http Server
//
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write(`request successfully proxied to: ${req.url}\n${JSON.stringify(req.headers, true, 2)}`);
  res.end();
}).listen(9002);

console.log(`${styleText('blue', 'http server ')}${styleText(['green', 'bold'], 'started ')}${styleText('blue', 'on port ')}${styleText('yellow', '8002 ')}${styleText(['cyan', 'underline'], 'with proxy.web() handler')}${styleText('magenta', ' and latency')}`);
console.log(`${styleText('blue', 'http server ')}${styleText(['green', 'bold'], 'started ')}${styleText('blue', 'on port ')}${styleText('yellow', '9002 ')}`);
