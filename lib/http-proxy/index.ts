import { EventEmitter } from 'eventemitter3';
import http from 'http';
import https from 'https';
import type { IncomingMessage, ServerResponse, Server } from 'http';
import type { Server as HttpsServer } from 'https';
import * as web from './passes/web-incoming.js';
import type { ProxyServerOptions, ProxyTargetUrl, ProxyPass, ErrorCallback } from '../types.js';

/**
 * Parse a URL string into a URL object with a `path` property
 * for backward compatibility with the legacy url.parse() API.
 */
function parseUrl(urlStr: string): ProxyTargetUrl {
  const parsed = new URL(urlStr);
  return {
    protocol: parsed.protocol,
    host: parsed.host,
    hostname: parsed.hostname,
    port: parsed.port || undefined,
    path: parsed.pathname + parsed.search,
    pathname: parsed.pathname,
    search: parsed.search,
  };
}

type WebHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  ...extraArgs: any[]
) => void;

/**
 * Returns a function that creates the loader for
 * `web`'s passes.
 */
function createRightProxy(): (options: ProxyServerOptions) => WebHandler {
  return function(options: ProxyServerOptions): WebHandler {
    return function(this: ProxyServer, req: IncomingMessage, res: ServerResponse, ...extraArgs: any[]) {
      const passes = this.webPasses;
      let cntr = extraArgs.length - 1;
      let head: Buffer | undefined;
      let cbl: ErrorCallback | undefined;

      if (typeof extraArgs[cntr] === 'function') {
        cbl = extraArgs[cntr];
        cntr--;
      }

      let requestOptions: ProxyServerOptions = options;
      if (
        cntr >= 0 &&
        !(extraArgs[cntr] instanceof Buffer) &&
        extraArgs[cntr] !== res
      ) {
        requestOptions = { ...options, ...extraArgs[cntr] };
        cntr--;
      }

      if (cntr >= 0 && extraArgs[cntr] instanceof Buffer) {
        head = extraArgs[cntr];
      }

      (['target', 'forward'] as const).forEach((e) => {
        if (typeof requestOptions[e] === 'string')
          (requestOptions as any)[e] = parseUrl(requestOptions[e] as string);
      });

      if (!requestOptions.target && !requestOptions.forward) {
        return this.emit('error', new Error('Must provide a proper URL as target'));
      }

      for (let i = 0; i < passes.length; i++) {
        if (passes[i](req, res, requestOptions, head, this, cbl)) {
          break;
        }
      }
    };
  };
}

class ProxyServer extends EventEmitter {
  web: WebHandler;
  proxyRequest: WebHandler;
  options: ProxyServerOptions;
  webPasses: ProxyPass[];
  _server: Server | HttpsServer | null = null;

  static createProxyServer: (options?: ProxyServerOptions) => ProxyServer;
  static createServer: (options?: ProxyServerOptions) => ProxyServer;
  static createProxy: (options?: ProxyServerOptions) => ProxyServer;

  constructor(options?: ProxyServerOptions) {
    super();

    options = options || {};
    options.prependPath = options.prependPath === false ? false : true;

    this.web = this.proxyRequest = createRightProxy()(options);
    this.options = options;

    this.webPasses = Object.keys(web).map((pass) => web[pass as keyof typeof web]) as ProxyPass[];

    this.on('error', this.onError, this);
  }

  onError(err: Error): void {
    //
    // Remark: Replicate node core behavior using EE3
    // so we force people to handle their own errors
    //
    if (this.listeners('error').length === 1) {
      throw err;
    }
  }

  listen(port: number, hostname?: string): this {
    const closure = (req: IncomingMessage, res: ServerResponse) => { this.web(req, res); };

    this._server = this.options.ssl ?
      https.createServer(this.options.ssl, closure) :
      http.createServer(closure);

    this._server.listen(port, hostname);

    return this;
  }

  close(callback?: (...args: any[]) => void): void {
    if (this._server) {
      this._server.close((...args: any[]) => {
        this._server = null;
        if (callback) {
          callback(...args);
        }
      });
    }
  }

  before(type: string, passName: string, callback: ProxyPass): void {
    if (type !== 'web') {
      throw new Error('type must be `web`');
    }
    const passes = this.webPasses;
    let i: number | false = false;

    passes.forEach((v, idx) => {
      if (v.name === passName) i = idx;
    });

    if (i === false) throw new Error('No such pass');

    passes.splice(i, 0, callback);
  }

  after(type: string, passName: string, callback: ProxyPass): void {
    if (type !== 'web') {
      throw new Error('type must be `web`');
    }
    const passes = this.webPasses;
    let i: number | false = false;

    passes.forEach((v, idx) => {
      if (v.name === passName) i = idx;
    });

    if (i === false) throw new Error('No such pass');

    passes.splice(i + 1, 0, callback);
  }
}

export default ProxyServer;
export { createRightProxy };
export type { WebHandler };
