import { describe, it, expect } from 'vitest';
import httpProxy from '../lib/http-proxy';
import http from 'http';
import net from 'net';
import SSE from 'sse';

let initialPort = 1024;
const gen: { port: number } = {} as any;
Object.defineProperty(gen, 'port', {
  get() {
    return initialPort++;
  }
});

describe('lib/http-proxy', () => {
  describe('#createProxyServer', () => {
    it.skip('should throw without options', () => {
      let error: unknown;
      try {
        httpProxy.createProxyServer();
      } catch(e) {
        error = e;
      }

      expect(error).toBeInstanceOf(Error);
    });

    it('should return an object otherwise', () => {
      const obj = httpProxy.createProxyServer({
        target: 'http://www.google.com:80'
      });

      expect(typeof obj.web).toBe('function');
      expect(typeof obj.listen).toBe('function');
    });
  });

  describe('#createProxyServer with forward options and using web-incoming passes', () => {
    it('should pipe the request using web-incoming#stream method', (ctx) => {
      return new Promise<void>((done) => {
        const ports = { source: gen.port, proxy: gen.port };
        const proxy = httpProxy.createProxyServer({
          forward: 'http://127.0.0.1:' + ports.source
        }).listen(ports.proxy);

        const source = http.createServer((req, res) => {
          expect(req.method).toEqual('GET');
          expect(req.headers.host!.split(':')[1]).toEqual(String(ports.proxy));
          source.close();
          proxy.close();
          done();
        });

        source.listen(ports.source);
        http.request('http://127.0.0.1:' + ports.proxy, () => {}).end();
      });
    });
  });

  describe('#createProxyServer using the web-incoming passes', () => {
    it('should proxy sse', () => {
      return new Promise<void>((done) => {
        const ports = { source: gen.port, proxy: gen.port };
        const proxy = httpProxy.createProxyServer({
          target: 'http://localhost:' + ports.source,
        });
        const proxyServer = proxy.listen(ports.proxy);
        const source = http.createServer();
        const sse = new SSE(source, {path: '/'});

        sse.on('connection', (client: any) => {
          client.send('Hello over SSE');
          client.close();
        });

        source.listen(ports.source);

        const options = {
          hostname: 'localhost',
          port: ports.proxy,
        };

        http.request(options, (res) => {
          let streamData = '';
          res.on('data', (chunk: Buffer) => {
            streamData += chunk.toString('utf8');
          });
          res.on('end', () => {
            expect(streamData).toEqual(':ok\n\ndata: Hello over SSE\n\n');
            source.close();
            proxy.close();
            done();
          });
        }).end();
      });
    });

    it('should make the request on pipe and finish it', () => {
      return new Promise<void>((done) => {
        const ports = { source: gen.port, proxy: gen.port };
        const proxy = httpProxy.createProxyServer({
          target: 'http://127.0.0.1:' + ports.source
        }).listen(ports.proxy);

        const source = http.createServer((req, res) => {
          expect(req.method).toEqual('POST');
          expect(req.headers['x-forwarded-for']).toEqual('127.0.0.1');
          expect(req.headers.host!.split(':')[1]).toEqual(String(ports.proxy));
          source.close();
          proxy.close();
          done();
        });

        source.listen(ports.source);

        http.request({
          hostname: '127.0.0.1',
          port: ports.proxy,
          method: 'POST',
          headers: {
            'x-forwarded-for': '127.0.0.1'
          }
        }, () => {}).end();
      });
    });
  });

  describe('#createProxyServer using the web-incoming passes', () => {
    it('should make the request, handle response and finish it', () => {
      return new Promise<void>((done) => {
        const ports = { source: gen.port, proxy: gen.port };
        const proxy = httpProxy.createProxyServer({
          target: 'http://127.0.0.1:' + ports.source,
          preserveHeaderKeyCase: true
        }).listen(ports.proxy);

        const source = http.createServer((req, res) => {
          expect(req.method).toEqual('GET');
          expect(req.headers.host!.split(':')[1]).toEqual(String(ports.proxy));
          res.writeHead(200, {'Content-Type': 'text/plain'});
          res.end('Hello from ' + (source.address() as net.AddressInfo).port);
        });

        source.listen(ports.source);

        http.request({
          hostname: '127.0.0.1',
          port: ports.proxy,
          method: 'GET'
        }, (res) => {
          expect(res.statusCode).toEqual(200);
          expect(res.headers['content-type']).toEqual('text/plain');
          if (res.rawHeaders != undefined) {
            expect(res.rawHeaders.indexOf('Content-Type')).not.toEqual(-1);
            expect(res.rawHeaders.indexOf('text/plain')).not.toEqual(-1);
          }

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

  describe('#createProxyServer() method with error response', () => {
    it('should make the request and emit the error event', () => {
      return new Promise<void>((done) => {
        const ports = { source: gen.port, proxy: gen.port };
        const proxy = httpProxy.createProxyServer({
          target: 'http://127.0.0.1:' + ports.source
        });

        proxy.on('error', (err: any) => {
          expect(err).toBeInstanceOf(Error);
          expect(err.code).toBe('ECONNREFUSED');
          proxy.close();
          done();
        });

        proxy.listen(ports.proxy);

        http.request({
          hostname: '127.0.0.1',
          port: ports.proxy,
          method: 'GET',
        }, () => {}).end();
      });
    });
  });

  describe('#createProxyServer setting the correct timeout value', () => {
    it('should hang up the socket at the timeout', { timeout: 30 }, () => {
      return new Promise<void>((done) => {
        const ports = { source: gen.port, proxy: gen.port };
        const proxy = httpProxy.createProxyServer({
          target: 'http://127.0.0.1:' + ports.source,
          timeout: 3
        }).listen(ports.proxy);

        proxy.on('error', (e: any) => {
          expect(e).toBeInstanceOf(Error);
          expect(e.code).toEqual('ECONNRESET');
        });

        const source = http.createServer((req, res) => {
          setTimeout(() => {
            res.end('At this point the socket should be closed');
          }, 5);
        });

        source.listen(ports.source);

        const testReq = http.request({
          hostname: '127.0.0.1',
          port: ports.proxy,
          method: 'GET',
        }, () => {});

        testReq.on('error', (e: any) => {
          expect(e).toBeInstanceOf(Error);
          expect(e.code).toEqual('ECONNRESET');
          proxy.close();
          source.close();
          done();
        });

        testReq.end();
      });
    });
  });

  describe('#createProxyServer with xfwd option', () => {
    it('should not throw on empty http host header', () => {
      return new Promise<void>((done) => {
        const ports = { source: gen.port, proxy: gen.port };
        const proxy = httpProxy.createProxyServer({
          forward: 'http://127.0.0.1:' + ports.source,
          xfwd: true
        }).listen(ports.proxy);

        const source = http.createServer((req, res) => {
          expect(req.method).toEqual('GET');
          expect(req.headers.host!.split(':')[1]).toEqual(String(ports.source));
          source.close();
          proxy.close();
          done();
        });

        source.listen(ports.source);

        const socket = net.connect({port: ports.proxy}, () => {
          socket.write('GET / HTTP/1.0\r\n\r\n');
        });

        socket.on('error', () => {
          expect.fail('Unexpected socket error');
        });

        socket.on('data', () => {
          socket.end();
        });

        socket.on('end', () => {
          expect('Socket to finish').toBeTruthy();
        });
      });
    });
  });

});
