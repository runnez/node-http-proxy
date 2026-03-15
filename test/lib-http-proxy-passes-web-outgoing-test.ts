import { describe, it, expect, beforeEach } from 'vitest';
import * as httpProxy from '../lib/http-proxy/passes/web-outgoing';

describe('lib/http-proxy/passes/web-outgoing', () => {
  describe('#setRedirectHostRewrite', () => {
    let req: any, proxyRes: any, options: any;

    beforeEach(() => {
      req = {
        headers: {
          host: 'ext-auto.com'
        }
      };
      proxyRes = {
        statusCode: 301,
        headers: {
          location: 'http://backend.com/'
        }
      };
      options = {
        target: 'http://backend.com'
      };
    });

    describe('rewrites location host with hostRewrite', () => {
      beforeEach(() => {
        options.hostRewrite = 'ext-manual.com';
      });
      [201, 301, 302, 307, 308].forEach((code) => {
        it('on ' + code, () => {
          proxyRes.statusCode = code;
          httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
          expect(proxyRes.headers.location).toEqual('http://ext-manual.com/');
        });
      });

      it('not on 200', () => {
        proxyRes.statusCode = 200;
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('http://backend.com/');
      });

      it('not when hostRewrite is unset', () => {
        delete options.hostRewrite;
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('http://backend.com/');
      });

      it('takes precedence over autoRewrite', () => {
        options.autoRewrite = true;
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('http://ext-manual.com/');
      });

      it('not when the redirected location does not match target host', () => {
        proxyRes.statusCode = 302;
        proxyRes.headers.location = 'http://some-other/';
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('http://some-other/');
      });

      it('not when the redirected location does not match target port', () => {
        proxyRes.statusCode = 302;
        proxyRes.headers.location = 'http://backend.com:8080/';
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('http://backend.com:8080/');
      });
    });

    describe('rewrites location host with autoRewrite', () => {
      beforeEach(() => {
        options.autoRewrite = true;
      });
      [201, 301, 302, 307, 308].forEach((code) => {
        it('on ' + code, () => {
          proxyRes.statusCode = code;
          httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
          expect(proxyRes.headers.location).toEqual('http://ext-auto.com/');
        });
      });

      it('not on 200', () => {
        proxyRes.statusCode = 200;
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('http://backend.com/');
      });

      it('not when autoRewrite is unset', () => {
        delete options.autoRewrite;
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('http://backend.com/');
      });

      it('not when the redirected location does not match target host', () => {
        proxyRes.statusCode = 302;
        proxyRes.headers.location = 'http://some-other/';
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('http://some-other/');
      });

      it('not when the redirected location does not match target port', () => {
        proxyRes.statusCode = 302;
        proxyRes.headers.location = 'http://backend.com:8080/';
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('http://backend.com:8080/');
      });
    });

    describe('rewrites location protocol with protocolRewrite', () => {
      beforeEach(() => {
        options.protocolRewrite = 'https';
      });
      [201, 301, 302, 307, 308].forEach((code) => {
        it('on ' + code, () => {
          proxyRes.statusCode = code;
          httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
          expect(proxyRes.headers.location).toEqual('https://backend.com/');
        });
      });

      it('not on 200', () => {
        proxyRes.statusCode = 200;
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('http://backend.com/');
      });

      it('not when protocolRewrite is unset', () => {
        delete options.protocolRewrite;
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('http://backend.com/');
      });

      it('works together with hostRewrite', () => {
        options.hostRewrite = 'ext-manual.com';
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('https://ext-manual.com/');
      });

      it('works together with autoRewrite', () => {
        options.autoRewrite = true;
        httpProxy.setRedirectHostRewrite(req, {} as any, proxyRes, options);
        expect(proxyRes.headers.location).toEqual('https://ext-auto.com/');
      });
    });
  });

  describe('#setConnection', () => {
    it('set the right connection with 1.0 - `close`', () => {
      const proxyRes = { headers: {} } as any;
      httpProxy.setConnection({
        httpVersion: '1.0',
        headers: {
          connection: null
        }
      } as any, {} as any, proxyRes);

      expect(proxyRes.headers.connection).toEqual('close');
    });

    it('set the right connection with 1.0 - req.connection', () => {
      const proxyRes = { headers: {} } as any;
      httpProxy.setConnection({
        httpVersion: '1.0',
        headers: {
          connection: 'hey'
        }
      } as any, {} as any, proxyRes);

      expect(proxyRes.headers.connection).toEqual('hey');
    });

    it('set the right connection - req.connection', () => {
      const proxyRes = { headers: {} } as any;
      httpProxy.setConnection({
        httpVersion: null,
        headers: {
          connection: 'hola'
        }
      } as any, {} as any, proxyRes);

      expect(proxyRes.headers.connection).toEqual('hola');
    });

    it('set the right connection - `keep-alive`', () => {
      const proxyRes = { headers: {} } as any;
      httpProxy.setConnection({
        httpVersion: null,
        headers: {
          connection: null
        }
      } as any, {} as any, proxyRes);

      expect(proxyRes.headers.connection).toEqual('keep-alive');
    });

    it('don`t set connection with 2.0 if exist', () => {
      const proxyRes = { headers: {} } as any;
      httpProxy.setConnection({
        httpVersion: '2.0',
        headers: {
          connection: 'namstey'
        }
      } as any, {} as any, proxyRes);

      expect(proxyRes.headers.connection).toEqual(undefined);
    });

    it('don`t set connection with 2.0 if doesn`t exist', () => {
      const proxyRes = { headers: {} } as any;
      httpProxy.setConnection({
        httpVersion: '2.0',
        headers: {}
      } as any, {} as any, proxyRes);

      expect(proxyRes.headers.connection).toEqual(undefined);
    });

  });

  describe('#writeStatusCode', () => {
    it('should write status code', () => {
      const res = {
        writeHead: (n: number) => {
          expect(n).toEqual(200);
        }
      } as any;

      httpProxy.writeStatusCode({} as any, res, { statusCode: 200 } as any);
    });
  });

  describe('#writeHeaders', () => {
    let proxyRes: any, rawProxyRes: any, res: any;

    beforeEach(() => {
      proxyRes = {
        headers: {
          hey: 'hello',
          how: 'are you?',
          'set-cookie': [
            'hello; domain=my.domain; path=/',
            'there; domain=my.domain; path=/'
          ]
        }
      };
      rawProxyRes = {
        headers: {
          hey: 'hello',
          how: 'are you?',
          'set-cookie': [
            'hello; domain=my.domain; path=/',
            'there; domain=my.domain; path=/'
          ]
        },
        rawHeaders: [
          'Hey', 'hello',
          'How', 'are you?',
          'Set-Cookie', 'hello; domain=my.domain; path=/',
          'Set-Cookie', 'there; domain=my.domain; path=/'
        ]
      };
      res = {
        setHeader: function(k: string, v: string | string[]) {
          this.headers[k.toLowerCase()] = v;
        },
        headers: {} as Record<string, string | string[]>
      };
    });

    it('writes headers', () => {
      const options = {};
      httpProxy.writeHeaders({} as any, res, proxyRes, options);

      expect(res.headers.hey).toEqual('hello');
      expect(res.headers.how).toEqual('are you?');

      expect(res.headers).toHaveProperty('set-cookie');
      expect(Array.isArray(res.headers['set-cookie'])).toBe(true);
      expect(res.headers['set-cookie']).toHaveLength(2);
    });

    it('writes raw headers', () => {
      const options = {};
      httpProxy.writeHeaders({} as any, res, rawProxyRes, options);

      expect(res.headers.hey).toEqual('hello');
      expect(res.headers.how).toEqual('are you?');

      expect(res.headers).toHaveProperty('set-cookie');
      expect(Array.isArray(res.headers['set-cookie'])).toBe(true);
      expect(res.headers['set-cookie']).toHaveLength(2);
    });

    it('rewrites path', () => {
      const options = {
        cookiePathRewrite: '/dummyPath'
      };

      httpProxy.writeHeaders({} as any, res, proxyRes, options);

      expect(res.headers['set-cookie'])
        .toContain('hello; domain=my.domain; path=/dummyPath');
    });

    it('does not rewrite path', () => {
      const options = {};

      httpProxy.writeHeaders({} as any, res, proxyRes, options);

      expect(res.headers['set-cookie'])
        .toContain('hello; domain=my.domain; path=/');
    });

    it('removes path', () => {
      const options = {
        cookiePathRewrite: ''
      };

      httpProxy.writeHeaders({} as any, res, proxyRes, options);

      expect(res.headers['set-cookie'])
        .toContain('hello; domain=my.domain');
    });

    it('does not rewrite domain', () => {
      const options = {};

      httpProxy.writeHeaders({} as any, res, proxyRes, options);

      expect(res.headers['set-cookie'])
        .toContain('hello; domain=my.domain; path=/');
    });

    it('rewrites domain', () => {
      const options = {
        cookieDomainRewrite: 'my.new.domain'
      };

      httpProxy.writeHeaders({} as any, res, proxyRes, options);

      expect(res.headers['set-cookie'])
        .toContain('hello; domain=my.new.domain; path=/');
    });

    it('removes domain', () => {
      const options = {
        cookieDomainRewrite: ''
      };

      httpProxy.writeHeaders({} as any, res, proxyRes, options);

      expect(res.headers['set-cookie'])
        .toContain('hello; path=/');
    });

    it('rewrites headers with advanced configuration', () => {
      const options = {
        cookieDomainRewrite: {
          '*': '',
          'my.old.domain': 'my.new.domain',
          'my.special.domain': 'my.special.domain'
        }
      };
      proxyRes.headers['set-cookie'] = [
        'hello-on-my.domain; domain=my.domain; path=/',
        'hello-on-my.old.domain; domain=my.old.domain; path=/',
        'hello-on-my.special.domain; domain=my.special.domain; path=/'
      ];
      httpProxy.writeHeaders({} as any, res, proxyRes, options);

      expect(res.headers['set-cookie'])
        .toContain('hello-on-my.domain; path=/');
      expect(res.headers['set-cookie'])
        .toContain('hello-on-my.old.domain; domain=my.new.domain; path=/');
      expect(res.headers['set-cookie'])
        .toContain('hello-on-my.special.domain; domain=my.special.domain; path=/');
    });

    it('rewrites raw headers with advanced configuration', () => {
      const options = {
        cookieDomainRewrite: {
          '*': '',
          'my.old.domain': 'my.new.domain',
          'my.special.domain': 'my.special.domain'
        }
      };
      rawProxyRes.headers['set-cookie'] = [
        'hello-on-my.domain; domain=my.domain; path=/',
        'hello-on-my.old.domain; domain=my.old.domain; path=/',
        'hello-on-my.special.domain; domain=my.special.domain; path=/'
      ];
      rawProxyRes.rawHeaders = rawProxyRes.rawHeaders.concat([
        'Set-Cookie',
        'hello-on-my.domain; domain=my.domain; path=/',
        'Set-Cookie',
        'hello-on-my.old.domain; domain=my.old.domain; path=/',
        'Set-Cookie',
        'hello-on-my.special.domain; domain=my.special.domain; path=/'
      ]);
      httpProxy.writeHeaders({} as any, res, rawProxyRes, options);

      expect(res.headers['set-cookie'])
        .toContain('hello-on-my.domain; path=/');
      expect(res.headers['set-cookie'])
        .toContain('hello-on-my.old.domain; domain=my.new.domain; path=/');
      expect(res.headers['set-cookie'])
        .toContain('hello-on-my.special.domain; domain=my.special.domain; path=/');
    });
  });


  describe('#removeChunked', () => {
    it('should remove transfer-encoding for HTTP 1.0', () => {
      const proxyRes = {
        headers: {
          'transfer-encoding': 'hello'
        }
      } as any;

      httpProxy.removeChunked({ httpVersion: '1.0' } as any, {} as any, proxyRes);

      expect(proxyRes.headers['transfer-encoding']).toEqual(undefined);
    });
  });

});
