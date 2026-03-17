/*
  error-handling.js: Example of handle erros for HTTP and WebSockets

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

import http from 'node:http';
import { styleText } from 'node:util';
import httpProxy from '../../dist/http-proxy.js';

//
// HTTP Proxy Server
//
const proxy = httpProxy.createProxyServer({target:'http://localhost:9000'});

//
// Example of error handling
//
const requestHandler = (req, res) => {
  // Pass a callback to the web proxy method
  // and catch the error there.
  proxy.web(req, res, (err) => {
    // Now you can get the err
    // and handle it by your self
    // if (err) throw err;
    res.writeHead(502);
    res.end("There was an error proxying your request");
  });
};

http.createServer(requestHandler).listen(8000);
console.log(`${styleText('blue', 'http proxy server')}${styleText(['green', 'bold'], ' started ')}${styleText('blue', 'on port ')}${styleText('yellow', '8000')}`);
