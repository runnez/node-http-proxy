import { describe, it, expect } from 'vitest';
import httpProxy from '../lib/http-proxy.js';
import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let initialPort = 2024;
const gen: { port: number } = {} as any;
Object.defineProperty(gen, 'port', {
  get() {
    return initialPort++;
  }
});

describe('lib/http-proxy.js', () => {
  describe('HTTPS #createProxyServer', () => {
    describe('HTTPS to HTTP', () => {
      it('should proxy the request and send back the response', () => {
        return new Promise<void>((done) => {
          const ports = { source: gen.port, proxy: gen.port };
          const source = http.createServer((req, res) => {
            expect(req.method).toEqual('GET');
            expect(req.headers.host!.split(':')[1]).toEqual(String(ports.proxy));
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hello from ' + ports.source);
          });

          source.listen(ports.source);

          const proxy = httpProxy.createProxyServer({
            target: 'http://127.0.0.1:' + ports.source,
            ssl: {
              key: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-key.pem')),
              cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-cert.pem')),
              ciphers: 'AES128-GCM-SHA256',
            }
          }).listen(ports.proxy);

          https.request({
            host: 'localhost',
            port: ports.proxy,
            path: '/',
            method: 'GET',
            rejectUnauthorized: false
          }, (res) => {
            expect(res.statusCode).toEqual(200);

            res.on('data', (data: Buffer) => {
              expect(data.toString()).toEqual('Hello from ' + ports.source);
            });

            res.on('end', () => {
              source.close();
              proxy.close();
              done();
            });
          }).end();
        });
      });
    });

    describe('HTTP to HTTPS', () => {
      it('should proxy the request and send back the response', () => {
        return new Promise<void>((done) => {
          const ports = { source: gen.port, proxy: gen.port };
          const source = https.createServer({
            key: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-key.pem')),
            cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-cert.pem')),
            ciphers: 'AES128-GCM-SHA256',
          }, (req, res) => {
            expect(req.method).toEqual('GET');
            expect(req.headers.host!.split(':')[1]).toEqual(String(ports.proxy));
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hello from ' + ports.source);
          });

          source.listen(ports.source);

          const proxy = httpProxy.createProxyServer({
            target: 'https://127.0.0.1:' + ports.source,
            secure: false
          }).listen(ports.proxy);

          http.request({
            hostname: '127.0.0.1',
            port: ports.proxy,
            method: 'GET'
          }, (res) => {
            expect(res.statusCode).toEqual(200);

            res.on('data', (data: Buffer) => {
              expect(data.toString()).toEqual('Hello from ' + ports.source);
            });

            res.on('end', () => {
              source.close();
              proxy.close();
              done();
            });
          }).end();
        });
      });
    });

    describe('HTTPS to HTTPS', () => {
      it('should proxy the request and send back the response', () => {
        return new Promise<void>((done) => {
          const ports = { source: gen.port, proxy: gen.port };
          const source = https.createServer({
            key: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-key.pem')),
            cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-cert.pem')),
            ciphers: 'AES128-GCM-SHA256',
          }, (req, res) => {
            expect(req.method).toEqual('GET');
            expect(req.headers.host!.split(':')[1]).toEqual(String(ports.proxy));
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hello from ' + ports.source);
          });

          source.listen(ports.source);

          const proxy = httpProxy.createProxyServer({
            target: 'https://127.0.0.1:' + ports.source,
            ssl: {
              key: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-key.pem')),
              cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-cert.pem')),
              ciphers: 'AES128-GCM-SHA256',
            },
            secure: false
          }).listen(ports.proxy);

          https.request({
            host: 'localhost',
            port: ports.proxy,
            path: '/',
            method: 'GET',
            rejectUnauthorized: false
          }, (res) => {
            expect(res.statusCode).toEqual(200);

            res.on('data', (data: Buffer) => {
              expect(data.toString()).toEqual('Hello from ' + ports.source);
            });

            res.on('end', () => {
              source.close();
              proxy.close();
              done();
            });
          }).end();
        });
      });
    });

    describe('HTTPS not allow SSL self signed', () => {
      it('should fail with error', () => {
        return new Promise<void>((done) => {
          const ports = { source: gen.port, proxy: gen.port };
          const source = https.createServer({
            key: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-key.pem')),
            cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-cert.pem')),
            ciphers: 'AES128-GCM-SHA256',
          }).listen(ports.source);

          const proxy = httpProxy.createProxyServer({
            target: 'https://127.0.0.1:' + ports.source,
            secure: true
          });

          proxy.listen(ports.proxy);

          proxy.on('error', (err: any, req: any, res: any) => {
            expect(err).toBeInstanceOf(Error);
            expect(err.toString()).toContain('Error: unable to verify the first certificate');
            done();
          });

          http.request({
            hostname: '127.0.0.1',
            port: ports.proxy,
            method: 'GET'
          }).end();
        });
      });
    });

    describe('HTTPS to HTTP using own server', () => {
      it('should proxy the request and send back the response', () => {
        return new Promise<void>((done) => {
          const ports = { source: gen.port, proxy: gen.port };
          const source = http.createServer((req, res) => {
            expect(req.method).toEqual('GET');
            expect(req.headers.host!.split(':')[1]).toEqual(String(ports.proxy));
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hello from ' + ports.source);
          });

          source.listen(ports.source);

          const proxy = httpProxy.createServer({
            agent: new http.Agent({ maxSockets: 2 })
          });

          const ownServer = https.createServer({
            key: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-key.pem')),
            cert: fs.readFileSync(path.join(__dirname, 'fixtures', 'agent2-cert.pem')),
            ciphers: 'AES128-GCM-SHA256',
          }, (req, res) => {
            proxy.web(req, res, {
              target: 'http://127.0.0.1:' + ports.source
            });
          }).listen(ports.proxy);

          https.request({
            host: 'localhost',
            port: ports.proxy,
            path: '/',
            method: 'GET',
            rejectUnauthorized: false
          }, (res) => {
            expect(res.statusCode).toEqual(200);

            res.on('data', (data: Buffer) => {
              expect(data.toString()).toEqual('Hello from ' + ports.source);
            });

            res.on('end', () => {
              source.close();
              ownServer.close();
              done();
            });
          }).end();
        });
      });
    });
  });
});
