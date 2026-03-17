/*
  bodyDecoder-middleware.js: Basic example of `connect.bodyParser()` middleware in node-http-proxy

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
import connect from 'connect';
import bodyParser from 'body-parser';
import httpProxy from '../../dist/http-proxy.js';

const proxy = httpProxy.createProxyServer({});


//restream parsed body before proxying
proxy.on('proxyReq', (proxyReq, req, res, options) => {
  if (!req.body || !Object.keys(req.body).length) {
    return;
  }

  const contentType = proxyReq.getHeader('Content-Type');
  let bodyData;

  if (contentType === 'application/json') {
    bodyData = JSON.stringify(req.body);
  }

  if (contentType === 'application/x-www-form-urlencoded') {
    bodyData = new URLSearchParams(req.body).toString();
  }

  if (bodyData) {
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  }
});


//
//  Basic Http Proxy Server
//
const app = connect()
  .use(bodyParser.json())//json parser
  .use(bodyParser.urlencoded())//urlencoded parser
  .use((req, res) => {
    // modify body here,
    // eg: req.body = {a: 1}.
    console.log('proxy body:', req.body);
    proxy.web(req, res, {
      target: 'http://127.0.0.1:9013'
    });
  });

http.createServer(app).listen(8013, () => {
  console.log('proxy linsten 8013');
});



//
//  Target Http Server
//
const app1 = connect()
  .use(bodyParser.json())
  .use((req, res) => {
    console.log('app1:', req.body);
    res.end(`request successfully proxied to: ${req.url}\n${JSON.stringify(req.headers, true, 2)}`);
  });
http.createServer(app1).listen(9013, async () => {
  //request to 8013 to proxy
  try {
    const jsonRes = await fetch('http://127.0.0.1:8013', {//
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({content: 123, type: "greeting from json request"})
    });
    const jsonData = await jsonRes.text();
    console.log('return for json request:', null, jsonData);
  } catch (err) {
    console.log('return for json request:', err);
  }

  // application/x-www-form-urlencoded request
  try {
    const formRes = await fetch('http://127.0.0.1:8013', {//
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({content: '123', type: "greeting from urlencoded request"}).toString()
    });
    const formData = await formRes.text();
    console.log('return for urlencoded request:', null, formData);
  } catch (err) {
    console.log('return for urlencoded request:', err);
  }
});
