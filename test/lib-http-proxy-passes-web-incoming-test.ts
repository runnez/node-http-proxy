import { describe, it, expect } from 'vitest';
import * as webPasses from '../lib/http-proxy/passes/web-incoming';
import HttpProxy from '../lib/http-proxy';
import concat from 'concat-stream';
import async from 'async';
import http from 'http';
import net from 'net';

let initialPort = 3024;
const gen: { port: number } = {} as any;
Object.defineProperty(gen, 'port', {
  get() {
    return initialPort++;
  }
});

describe('lib/http-proxy/passes/web', () => {
  describe('#deleteLength', () => {
    it('should change `content-length` for DELETE requests', () => {
      const stubRequest = {
        method: 'DELETE',
        headers: {} as Record<string, string>
      };
      webPasses.deleteLength(stubRequest as any, {} as any, {} as any);
      expect(stubRequest.headers['content-length']).toEqual('0');
    });

    it('should change `content-length` for OPTIONS requests', () => {
      const stubRequest = {
        method: 'OPTIONS',
        headers: {} as Record<string, string>
      };
      webPasses.deleteLength(stubRequest as any, {} as any, {} as any);
      expect(stubRequest.headers['content-length']).toEqual('0');
    });

    it('should remove `transfer-encoding` from empty DELETE requests', () => {
      const stubRequest = {
        method: 'DELETE',
        headers: {
          'transfer-encoding': 'chunked'
        } as Record<string, string>
      };
      webPasses.deleteLength(stubRequest as any, {} as any, {} as any);
      expect(stubRequest.headers['content-length']).toEqual('0');
      expect(stubRequest.headers).not.toHaveProperty('transfer-encoding');
    });
  });

  describe('#timeout', () => {
    it('should set timeout on the socket', () => {
      let result: number | false = false;
      const stubRequest = {
        socket: {
          setTimeout: (value: number) => { result = value; }
        }
      };

      webPasses.timeout(stubRequest as any, {} as any, { timeout: 5000});
      expect(result).toEqual(5000);
    });
  });

  describe('#XHeaders', () => {
    const stubRequest = {
      connection: {
        encrypted: false,
      },
      socket: {
        remoteAddress: '192.168.1.2',
        remotePort: '8080'
      },
      headers: {
        host: '192.168.1.2:8080'
      } as Record<string, string>
    };

    it('set the correct x-forwarded-* headers', () => {
      webPasses.XHeaders(stubRequest as any, {} as any, { xfwd: true });
      expect(stubRequest.headers['x-forwarded-for']).toBe('192.168.1.2');
      expect(stubRequest.headers['x-forwarded-port']).toBe('8080');
      expect(stubRequest.headers['x-forwarded-proto']).toBe('http');
    });
  });
});

describe('#createProxyServer.web() using own http server', () => {
  it('should proxy the request using the web proxy handler', () => {
    return new Promise<void>((done) => {
      const ports = { source: gen.port, proxy: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.source
      });

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.web(req, res);
      }

      const proxyServer = http.createServer(requestHandler);

      const source = http.createServer((req, res) => {
        source.close();
        proxyServer.close();
        expect(req.method).toEqual('GET');
        expect(req.headers.host!.split(':')[1]).toEqual(String(ports.proxy));
        done();
      });

      proxyServer.listen(ports.proxy);
      source.listen(ports.source);

      http.request('http://127.0.0.1:' + ports.proxy, () => {}).end();
    });
  });

  it('should detect a proxyReq event and modify headers', () => {
    return new Promise<void>((done) => {
      const ports = { source: gen.port, proxy: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.source,
      });

      proxy.on('proxyReq', (proxyReq: http.ClientRequest, req: http.IncomingMessage, res: http.ServerResponse, options: any) => {
        proxyReq.setHeader('X-Special-Proxy-Header', 'foobar');
      });

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.web(req, res);
      }

      const proxyServer = http.createServer(requestHandler);

      const source = http.createServer((req, res) => {
        source.close();
        proxyServer.close();
        expect(req.headers['x-special-proxy-header']).toEqual('foobar');
        done();
      });

      proxyServer.listen(ports.proxy);
      source.listen(ports.source);

      http.request('http://127.0.0.1:' + ports.proxy, () => {}).end();
    });
  });

  it('should skip proxyReq event when handling a request with header "expect: 100-continue"', () => {
    return new Promise<void>((done) => {
      const ports = { source: gen.port, proxy: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.source,
      });

      proxy.on('proxyReq', (proxyReq: http.ClientRequest, req: http.IncomingMessage, res: http.ServerResponse, options: any) => {
        proxyReq.setHeader('X-Special-Proxy-Header', 'foobar');
      });

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.web(req, res);
      }

      const proxyServer = http.createServer(requestHandler);

      const source = http.createServer((req, res) => {
        source.close();
        proxyServer.close();
        expect(req.headers['x-special-proxy-header']).not.toEqual('foobar');
        done();
      });

      proxyServer.listen(ports.proxy);
      source.listen(ports.source);

      const postData = ''.padStart(1025, 'x');

      const postOptions = {
        hostname: '127.0.0.1',
        port: ports.proxy,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'expect': '100-continue'
        }
      };

      const req = http.request(postOptions, () => {});
      req.write(postData);
      req.end();
    });
  });

  it('should proxy the request and handle error via callback', () => {
    return new Promise<void>((done) => {
      const ports = { proxy: gen.port, dead: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.dead
      });

      const proxyServer = http.createServer(requestHandler);

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.web(req, res, undefined, (err: any) => {
          proxyServer.close();
          expect(err).toBeInstanceOf(Error);
          expect(err.code).toBe('ECONNREFUSED');
          done();
        });
      }

      proxyServer.listen(ports.proxy);

      http.request({
        hostname: '127.0.0.1',
        port: ports.proxy,
        method: 'GET',
      }, () => {}).end();
    });
  });

  it('should proxy the request and handle error via event listener', () => {
    return new Promise<void>((done) => {
      const ports = { proxy: gen.port, dead: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.dead
      });

      const proxyServer = http.createServer(requestHandler);

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.once('error', (err: any, errReq: any, errRes: any) => {
          proxyServer.close();
          expect(err).toBeInstanceOf(Error);
          expect(errReq).toBe(req);
          expect(errRes).toBe(res);
          expect(err.code).toBe('ECONNREFUSED');
          done();
        });

        proxy.web(req, res);
      }

      proxyServer.listen(ports.proxy);

      http.request({
        hostname: '127.0.0.1',
        port: ports.proxy,
        method: 'GET',
      }, () => {}).end();
    });
  });

  it('should forward the request and handle error via event listener', () => {
    return new Promise<void>((done) => {
      const ports = { proxy: gen.port, dead: gen.port };
      const proxy = HttpProxy.createProxyServer({
        forward: 'http://127.0.0.1:' + ports.dead
      });

      const proxyServer = http.createServer(requestHandler);

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.once('error', (err: any, errReq: any, errRes: any) => {
          proxyServer.close();
          expect(err).toBeInstanceOf(Error);
          expect(errReq).toBe(req);
          expect(errRes).toBe(res);
          expect(err.code).toBe('ECONNREFUSED');
          done();
        });

        proxy.web(req, res);
      }

      proxyServer.listen(ports.proxy);

      http.request({
        hostname: '127.0.0.1',
        port: ports.proxy,
        method: 'GET',
      }, () => {}).end();
    });
  });

  it('should proxy the request and handle timeout error (proxyTimeout)', () => {
    return new Promise<void>((done) => {
      const ports = { proxy: gen.port, blackhole: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.blackhole,
        proxyTimeout: 100
      });

      const blackhole = net.createServer();
      blackhole.listen(ports.blackhole);

      const proxyServer = http.createServer(requestHandler);

      const started = new Date().getTime();
      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.once('error', (err: any, errReq: any, errRes: any) => {
          proxyServer.close();
          blackhole.close();
          expect(err).toBeInstanceOf(Error);
          expect(errReq).toBe(req);
          expect(errRes).toBe(res);
          expect(new Date().getTime() - started).toBeGreaterThan(99);
          expect(err.code).toBe('ECONNRESET');
          done();
        });

        proxy.web(req, res);
      }

      proxyServer.listen(ports.proxy);

      http.request({
        hostname: '127.0.0.1',
        port: ports.proxy,
        method: 'GET',
      }, () => {}).end();
    });
  });

  it('should proxy the request and handle timeout error', () => {
    return new Promise<void>((done) => {
      const ports = { proxy: gen.port, blackhole: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.blackhole,
        timeout: 100
      });

      const blackhole = net.createServer();
      blackhole.listen(ports.blackhole);

      const proxyServer = http.createServer(requestHandler);

      let cnt = 0;
      const doneOne = () => {
        cnt += 1;
        if (cnt === 2) done();
      };

      const started = new Date().getTime();
      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.once('econnreset', (err: any, errReq: any, errRes: any) => {
          proxyServer.close();
          blackhole.close();
          expect(err).toBeInstanceOf(Error);
          expect(errReq).toBe(req);
          expect(errRes).toBe(res);
          expect(err.code).toBe('ECONNRESET');
          doneOne();
        });

        proxy.web(req, res);
      }

      proxyServer.listen(ports.proxy);

      const req = http.request({
        hostname: '127.0.0.1',
        port: ports.proxy,
        method: 'GET',
      }, () => {});

      req.on('error', (err: any) => {
        expect(err).toBeInstanceOf(Error);
        expect(err.code).toBe('ECONNRESET');
        expect(new Date().getTime() - started).toBeGreaterThan(99);
        doneOne();
      });
      req.end();
    });
  });

  it('should proxy the request and provide a proxyRes event with the request and response parameters', () => {
    return new Promise<void>((done) => {
      const ports = { source: gen.port, proxy: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.source
      });

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.once('proxyRes', (proxyRes: any, pReq: any, pRes: any) => {
          source.close();
          proxyServer.close();
          expect(pReq).toBe(req);
          expect(pRes).toBe(res);
          done();
        });

        proxy.web(req, res);
      }

      const proxyServer = http.createServer(requestHandler);

      const source = http.createServer((req, res) => {
        res.end('Response');
      });

      proxyServer.listen(ports.proxy);
      source.listen(ports.source);
      http.request('http://127.0.0.1:' + ports.proxy, () => {}).end();
    });
  });

  it('should proxy the request and provide and respond to manual user response when using modifyResponse', () => {
    return new Promise<void>((done) => {
      const ports = { source: gen.port, proxy: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.source,
        selfHandleResponse: true
      });

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.once('proxyRes', (proxyRes: any, pReq: any, pRes: any) => {
          proxyRes.pipe(concat((body: Buffer) => {
            expect(body.toString('utf8')).toEqual('Response');
            pRes.end(Buffer.from('my-custom-response'));
          }));
        });

        proxy.web(req, res);
      }

      const proxyServer = http.createServer(requestHandler);

      const source = http.createServer((req, res) => {
        res.end('Response');
      });

      async.parallel([
        (next: any) => proxyServer.listen(ports.proxy, next),
        (next: any) => source.listen(ports.source, next)
      ], (err: any) => {
        http.get('http://127.0.0.1:' + ports.proxy, (res) => {
          res.pipe(concat((body: Buffer) => {
            expect(body.toString('utf8')).toEqual('my-custom-response');
            source.close();
            proxyServer.close();
            done();
          }));
        }).once('error', done);
      });
    });
  });

  it('should proxy the request and handle changeOrigin option', () => {
    return new Promise<void>((done) => {
      const ports = { source: gen.port, proxy: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.source,
        changeOrigin: true
      });

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.web(req, res);
      }

      const proxyServer = http.createServer(requestHandler);

      const source = http.createServer((req, res) => {
        source.close();
        proxyServer.close();
        expect(req.method).toEqual('GET');
        expect(req.headers.host!.split(':')[1]).toEqual(String(ports.source));
        done();
      });

      proxyServer.listen(ports.proxy);
      source.listen(ports.source);

      http.request('http://127.0.0.1:' + ports.proxy, () => {}).end();
    });
  });

  it('should proxy the request with the Authorization header set', () => {
    return new Promise<void>((done) => {
      const ports = { source: gen.port, proxy: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.source,
        auth: 'user:pass'
      });

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.web(req, res);
      }

      const proxyServer = http.createServer(requestHandler);

      const source = http.createServer((req, res) => {
        source.close();
        proxyServer.close();
        const auth = Buffer.from(req.headers.authorization!.split(' ')[1], 'base64');
        expect(req.method).toEqual('GET');
        expect(auth.toString()).toEqual('user:pass');
        done();
      });

      proxyServer.listen(ports.proxy);
      source.listen(ports.source);

      http.request('http://127.0.0.1:' + ports.proxy, () => {}).end();
    });
  });

  it('should proxy requests to multiple servers with different options', () => {
    return new Promise<void>((done) => {
      const ports = { proxy: gen.port, source1: gen.port, source2: gen.port };
      const proxy = HttpProxy.createProxyServer();

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        if (req.url!.indexOf('/s1/') === 0) {
          proxy.web(req, res, {
            ignorePath: true,
            target: 'http://127.0.0.1:' + ports.source1 + req.url!.substring(3)
          });
        } else {
          proxy.web(req, res, {
            target: 'http://127.0.0.1:' + ports.source2
          });
        }
      }

      const proxyServer = http.createServer(requestHandler);

      const source1 = http.createServer((req, res) => {
        expect(req.method).toEqual('GET');
        expect(req.headers.host!.split(':')[1]).toEqual(String(ports.proxy));
        expect(req.url).toEqual('/test1');
      });

      const source2 = http.createServer((req, res) => {
        source1.close();
        source2.close();
        proxyServer.close();
        expect(req.method).toEqual('GET');
        expect(req.headers.host!.split(':')[1]).toEqual(String(ports.proxy));
        expect(req.url).toEqual('/test2');
        done();
      });

      proxyServer.listen(ports.proxy);
      source1.listen(ports.source1);
      source2.listen(ports.source2);

      http.request('http://127.0.0.1:' + ports.proxy + '/s1/test1', () => {}).end();
      http.request('http://127.0.0.1:' + ports.proxy + '/test2', () => {}).end();
    });
  });
});

describe('#followRedirects', () => {
  it('should proxy the request follow redirects', () => {
    return new Promise<void>((done) => {
      const ports = { source: gen.port, proxy: gen.port };
      const proxy = HttpProxy.createProxyServer({
        target: 'http://127.0.0.1:' + ports.source,
        followRedirects: true
      });

      function requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        proxy.web(req, res);
      }

      const proxyServer = http.createServer(requestHandler);

      const source = http.createServer((req, res) => {
        const pathname = new URL(req.url!, 'http://localhost').pathname;
        if (pathname === '/redirect') {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ok');
          return;
        }

        res.writeHead(301, { 'Location': '/redirect' });
        res.end();
      });

      proxyServer.listen(ports.proxy);
      source.listen(ports.source);

      http.request('http://127.0.0.1:' + ports.proxy, (res) => {
        source.close();
        proxyServer.close();
        expect(res.statusCode).toEqual(200);
        done();
      }).end();
    });
  });
});
