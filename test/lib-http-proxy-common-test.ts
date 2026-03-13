import { describe, it, expect } from 'vitest';
import * as common from '../lib/http-proxy/common.js';

describe('lib/http-proxy/common.js', () => {
  describe('#setupOutgoing', () => {
    it('should setup the correct headers', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing,
      {
        agent     : '?' as any,
        target: {
          host      : 'hey',
          hostname  : 'how',
          socketPath: 'are',
          port      : 'you',
        },
        headers: {'fizz': 'bang', 'overwritten': 'true'},
        localAddress: 'local.address',
        auth:'username:pass'
      },
      {
        method    : 'i',
        url      : 'am',
        headers   : {'pro':'xy','overwritten':'false'}
      } as any);

      expect(outgoing.host).toEqual('hey');
      expect(outgoing.hostname).toEqual('how');
      expect(outgoing.socketPath).toEqual('are');
      expect(outgoing.port).toEqual('you');
      expect(outgoing.agent).toEqual('?');

      expect(outgoing.method).toEqual('i');
      expect(outgoing.path).toEqual('am');

      expect(outgoing.headers.pro).toEqual('xy');
      expect(outgoing.headers.fizz).toEqual('bang');
      expect(outgoing.headers.overwritten).toEqual('true');
      expect(outgoing.localAddress).toEqual('local.address');
      expect(outgoing.auth).toEqual('username:pass');
    });

    it('should not override agentless upgrade header', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing,
        {
          agent: undefined,
          target: {
            host      : 'hey',
            hostname  : 'how',
            socketPath: 'are',
            port      : 'you',
          },
          headers: {'connection': 'upgrade'},
        },
        {
          method    : 'i',
          url      : 'am',
          headers   : {'pro':'xy','overwritten':'false'}
        } as any);
      expect(outgoing.headers.connection).toEqual('upgrade');
    });

    it('should not override agentless connection: contains upgrade', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing,
        {
          agent: undefined,
          target: {
            host      : 'hey',
            hostname  : 'how',
            socketPath: 'are',
            port      : 'you',
          },
          headers: {'connection': 'keep-alive, upgrade'},
        },
        {
          method    : 'i',
          url      : 'am',
          headers   : {'pro':'xy','overwritten':'false'}
        } as any);
      expect(outgoing.headers.connection).toEqual('keep-alive, upgrade');
    });

    it('should override agentless connection: contains improper upgrade', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing,
        {
          agent: undefined,
          target: {
            host      : 'hey',
            hostname  : 'how',
            socketPath: 'are',
            port      : 'you',
          },
          headers: {'connection': 'keep-alive, not upgrade'},
        },
        {
          method    : 'i',
          url      : 'am',
          headers   : {'pro':'xy','overwritten':'false'}
        } as any);
      expect(outgoing.headers.connection).toEqual('close');
    });

    it('should override agentless non-upgrade header to close', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing,
        {
          agent: undefined,
          target: {
            host      : 'hey',
            hostname  : 'how',
            socketPath: 'are',
            port      : 'you',
          },
          headers: {'connection': 'xyz'},
        },
        {
          method    : 'i',
          url      : 'am',
          headers   : {'pro':'xy','overwritten':'false'}
        } as any);
      expect(outgoing.headers.connection).toEqual('close');
    });

    it('should set the agent to false if none is given', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing, {target:
        'http://localhost' as any
      }, { url: '/' } as any);
      expect(outgoing.agent).toEqual(false);
    });

    it('set the port according to the protocol', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing,
      {
        agent     : '?' as any,
        target: {
          host      : 'how',
          hostname  : 'are',
          socketPath: 'you',
          protocol: 'https:'
        }
      },
      {
        method    : 'i',
        url      : 'am',
        headers   : {pro:'xy'}
      } as any);

      expect(outgoing.host).toEqual('how');
      expect(outgoing.hostname).toEqual('are');
      expect(outgoing.socketPath).toEqual('you');
      expect(outgoing.agent).toEqual('?');

      expect(outgoing.method).toEqual('i');
      expect(outgoing.path).toEqual('am');
      expect(outgoing.headers.pro).toEqual('xy');

      expect(outgoing.port).toEqual(443);
    });

    it('should keep the original target path in the outgoing path', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing, {target:
        { path: 'some-path' }
      }, { url : 'am' } as any);

      expect(outgoing.path).toEqual('some-path/am');
    });

    it('should keep the original forward path in the outgoing path', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing, {
        target: {},
        forward: {
          path: 'some-path'
        }
      }, {
        url : 'am'
      } as any, 'forward');

      expect(outgoing.path).toEqual('some-path/am');
    });

    it('should properly detect https protocol without the colon', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing, {
        target: {
          protocol: 'https',
          host: 'whatever.com'
        }
      }, { url: '/' } as any);

      expect(outgoing.port).toEqual(443);
    });

    it('should not prepend the target path to the outgoing path with prependPath = false', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing, {
        target: { path: 'hellothere' },
        prependPath: false
      }, { url: 'hi' } as any);

      expect(outgoing.path).toEqual('hi');
    });

    it('should properly join paths', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing, {
        target: { path: '/forward' },
      }, { url: '/static/path' } as any);

      expect(outgoing.path).toEqual('/forward/static/path');
    });

    it('should not modify the query string', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing, {
        target: { path: '/forward' },
      }, { url: '/?foo=bar//&target=http://foobar.com/?a=1%26b=2&other=2' } as any);

      expect(outgoing.path).toEqual('/forward/?foo=bar//&target=http://foobar.com/?a=1%26b=2&other=2');
    });

    it('should correctly format the toProxy URL', () => {
      const outgoing = {} as any;
      const google = 'https://google.com';
      common.setupOutgoing(outgoing, {
        target: new URL('http://sometarget.com:80') as any,
        toProxy: true,
      }, { url: google } as any);

      expect(outgoing.path).toEqual('/' + google);
    });

    it('should not replace :\\ to :\\\\ when no https word before', () => {
      const outgoing = {} as any;
      const google = 'https://google.com:/join/join.js';
      common.setupOutgoing(outgoing, {
        target: new URL('http://sometarget.com:80') as any,
        toProxy: true,
      }, { url: google } as any);

      expect(outgoing.path).toEqual('/' + google);
    });

    it('should not replace :\\ to :\\\\ when no http word before', () => {
      const outgoing = {} as any;
      const google = 'http://google.com:/join/join.js';
      common.setupOutgoing(outgoing, {
        target: new URL('http://sometarget.com:80') as any,
        toProxy: true,
      }, { url: google } as any);

      expect(outgoing.path).toEqual('/' + google);
    });

    describe('when using ignorePath', () => {
      it('should ignore the path of the `req.url` passed in but use the target path', () => {
        const outgoing = {} as any;
        const myEndpoint = 'https://whatever.com/some/crazy/path/whoooo';
        common.setupOutgoing(outgoing, {
          target: new URL(myEndpoint) as any,
          ignorePath: true
        }, { url: '/more/crazy/pathness' } as any);

        expect(outgoing.path).toEqual('/some/crazy/path/whoooo');
      });

      it('and prependPath: false, it should ignore path of target and incoming request', () => {
        const outgoing = {} as any;
        const myEndpoint = 'https://whatever.com/some/crazy/path/whoooo';
        common.setupOutgoing(outgoing, {
          target: new URL(myEndpoint) as any,
          ignorePath: true,
          prependPath: false
        }, { url: '/more/crazy/pathness' } as any);

        expect(outgoing.path).toEqual('');
      });
    });

    describe('when using changeOrigin', () => {
      it('should correctly set the port to the host when it is a non-standard port using new URL', () => {
        const outgoing = {} as any;
        const myEndpoint = 'https://myCouch.com:6984';
        common.setupOutgoing(outgoing, {
          target: new URL(myEndpoint) as any,
          changeOrigin: true
        }, { url: '/' } as any);

        expect(outgoing.headers.host).toEqual('mycouch.com:6984');
      });

      it('should correctly set the port to the host when it is a non-standard port when setting host and port manually (which ignores port)', () => {
        const outgoing = {} as any;
        common.setupOutgoing(outgoing, {
          target: {
            protocol: 'https:',
            host: 'mycouch.com',
            port: 6984
          },
          changeOrigin: true
        }, { url: '/' } as any);
        expect(outgoing.headers.host).toEqual('mycouch.com:6984');
      });
    });

    it('should pass through https client parameters', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing,
      {
        agent     : '?' as any,
        target: {
          host      : 'how',
          hostname  : 'are',
          socketPath: 'you',
          protocol: 'https:',
          pfx: 'my-pfx',
          key: 'my-key',
          passphrase: 'my-passphrase',
          cert: 'my-cert',
          ca: 'my-ca',
          ciphers: 'my-ciphers',
          secureProtocol: 'my-secure-protocol'
        }
      },
      {
        method    : 'i',
        url      : 'am'
      } as any);

      expect(outgoing.pfx).toEqual('my-pfx');
      expect(outgoing.key).toEqual('my-key');
      expect(outgoing.passphrase).toEqual('my-passphrase');
      expect(outgoing.cert).toEqual('my-cert');
      expect(outgoing.ca).toEqual('my-ca');
      expect(outgoing.ciphers).toEqual('my-ciphers');
      expect(outgoing.secureProtocol).toEqual('my-secure-protocol');
    });

    it('should handle overriding the `method` of the http request', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing, {
        target: new URL('https://whooooo.com') as any,
        method: 'POST' ,
      }, { method: 'GET', url: '' } as any);

      expect(outgoing.method).toEqual('POST');
    });

    it('should not pass null as last arg to #urlJoin', () => {
      const outgoing = {} as any;
      common.setupOutgoing(outgoing, {target:
        { path: '' }
      }, { url : '' } as any);

      expect(outgoing.path).toBe('');
    });

  });

});
