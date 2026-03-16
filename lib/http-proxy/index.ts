import { EventEmitter } from 'eventemitter3';
import http from 'http';
import https from 'https';
import type { IncomingMessage, ServerResponse, ClientRequest, Server } from 'http';
import type { Server as HttpsServer } from 'https';
import * as web from './passes/web-incoming';
import type {
  ServerOptions,
  ProxyTargetUrl,
  ProxyPass,
  ErrorCallback,
  StartCallback,
  ProxyReqCallback,
  ProxyResCallback,
  EconnresetCallback,
  EndCallback,
} from '../types';

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

class ProxyServer<
  TIncomingMessage = IncomingMessage,
  TServerResponse = ServerResponse,
> extends EventEmitter {
  options: ServerOptions;
  webPasses: ProxyPass[];
  _server: Server | HttpsServer | null = null;

  static createServer: <T = IncomingMessage, U = ServerResponse>(options?: ServerOptions) => ProxyServer<T, U> = (options) => new ProxyServer(options);
  static createProxyServer: <T = IncomingMessage, U = ServerResponse>(options?: ServerOptions) => ProxyServer<T, U> = (options) => new ProxyServer(options);

  constructor(options?: ServerOptions) {
    super();

    options = options || {};
    options.prependPath = options.prependPath === false ? false : true;

    this.options = options;
    this.webPasses = Object.keys(web).map((pass) => web[pass as keyof typeof web]) as ProxyPass[];

    super.on('error', this.onError, this);
  }

  /**
   * Used for proxying regular HTTP(S) requests.
   */
  web(req: IncomingMessage, res: ServerResponse, options?: ServerOptions, callback?: ErrorCallback): void {
    let requestOptions: ServerOptions = options
      ? { ...this.options, ...options }
      : this.options;

    (['target', 'forward'] as const).forEach((e) => {
      if (typeof requestOptions[e] === 'string')
        (requestOptions as any)[e] = parseUrl(requestOptions[e] as string);
    });

    if (!requestOptions.target && !requestOptions.forward) {
      this.emit('error', new Error('Must provide a proper URL as target'));
      return;
    }

    for (let i = 0; i < this.webPasses.length; i++) {
      if (this.webPasses[i](req, res, requestOptions, undefined, this, callback)) {
        break;
      }
    }
  }

  /**
   * Alias for {@link web}.
   */
  proxyRequest(req: IncomingMessage, res: ServerResponse, options?: ServerOptions, callback?: ErrorCallback): void {
    this.web(req, res, options, callback);
  }

  onError(err: Error): void {
    // Remark: Replicate node core behavior using EE3
    // so we force people to handle their own errors
    if (this.listeners('error').length === 1) {
      throw err;
    }
  }

  listen(port: number, hostname?: string): this {
    const closure = (req: IncomingMessage, res: ServerResponse) => { this.web(req, res); };

    this._server = this.options.ssl
      ? https.createServer(this.options.ssl, closure)
      : http.createServer(closure);

    this._server.listen(port, hostname);

    return this;
  }

  close(callback?: () => void): void {
    if (this._server) {
      this._server.close((...args: any[]) => {
        this._server = null;
        if (callback) {
          callback();
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

  on(event: 'error', listener: ErrorCallback<Error, TIncomingMessage, TServerResponse>): this;
  on(event: 'start', listener: StartCallback<TIncomingMessage, TServerResponse>): this;
  on(event: 'proxyReq', listener: ProxyReqCallback<ClientRequest, TIncomingMessage, TServerResponse>): this;
  on(event: 'proxyRes', listener: ProxyResCallback<TIncomingMessage, TServerResponse>): this;
  on(event: 'econnreset', listener: EconnresetCallback<Error, TIncomingMessage, TServerResponse>): this;
  on(event: 'end', listener: EndCallback<TIncomingMessage, TServerResponse>): this;
  on(event: string, listener: (...args: any[]) => void): this;
  on(event: string, listener: (...args: any[]) => void, context?: any): this {
    return super.on(event, listener, context);
  }

  once(event: 'error', listener: ErrorCallback<Error, TIncomingMessage, TServerResponse>): this;
  once(event: 'start', listener: StartCallback<TIncomingMessage, TServerResponse>): this;
  once(event: 'proxyReq', listener: ProxyReqCallback<ClientRequest, TIncomingMessage, TServerResponse>): this;
  once(event: 'proxyRes', listener: ProxyResCallback<TIncomingMessage, TServerResponse>): this;
  once(event: 'econnreset', listener: EconnresetCallback<Error, TIncomingMessage, TServerResponse>): this;
  once(event: 'end', listener: EndCallback<TIncomingMessage, TServerResponse>): this;
  once(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void, context?: any): this {
    return super.once(event, listener, context);
  }
}

export default ProxyServer;
