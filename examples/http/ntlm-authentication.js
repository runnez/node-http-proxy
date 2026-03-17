import http from 'node:http';
import httpProxy from '../../dist/http-proxy.js';
import Agent from 'agentkeepalive';

const agent = new Agent({
  maxSockets: 100,
  keepAlive: true,
  maxFreeSockets: 10,
  keepAliveMsecs: 1000,
  timeout: 60000,
  keepAliveTimeout: 30000 // free socket keepalive for 30 seconds
});

const proxy = httpProxy.createProxy({ target: 'http://whatever.com', agent });

//
// Modify headers of the response before it gets sent
// So that we handle the NLTM authentication response
//
proxy.on('proxyRes', (proxyRes) => {
  const key = 'www-authenticate';
  proxyRes.headers[key] = proxyRes.headers[key] && proxyRes.headers[key].split(',');
});

http.createServer((req, res) => {
  proxy.web(req, res);
}).listen(3000);
