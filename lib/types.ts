import type { IncomingMessage, ServerResponse, ClientRequest } from 'http';
import type { Socket } from 'net';
import type { Stream } from 'stream';

export interface ProxyTargetDetailed {
  host: string;
  port: number;
  protocol?: string;
  hostname?: string;
  socketPath?: string;
  key?: string;
  passphrase?: string;
  pfx?: Buffer | string;
  cert?: string;
  ca?: string;
  ciphers?: string;
  secureProtocol?: string;
}

export interface ProxyTargetUrl {
  protocol?: string;
  host?: string;
  hostname?: string;
  port?: string | number;
  path?: string;
  pathname?: string;
  search?: string;
}

export type ProxyTarget = string | ProxyTargetUrl | ProxyTargetDetailed;

export interface ServerOptions {
  /** URL string to be parsed with the url module. */
  target?: ProxyTarget;
  /** URL string to be parsed with the url module. */
  forward?: ProxyTarget;
  /** Object to be passed to http(s).request. */
  agent?: any;
  /** Object to be passed to https.createServer(). */
  ssl?: any;
  /** Adds x-forward headers. */
  xfwd?: boolean;
  /** Verify SSL certificate. */
  secure?: boolean;
  /** Explicitly specify if we are proxying to another proxy. */
  toProxy?: boolean;
  /** Specify whether you want to prepend the target's path to the proxy path. */
  prependPath?: boolean;
  /** Specify whether you want to ignore the proxy path of the incoming request. */
  ignorePath?: boolean;
  /** Local interface string to bind for outgoing connections. */
  localAddress?: string;
  /** Changes the origin of the host header to the target URL. */
  changeOrigin?: boolean;
  /** Specify whether you want to keep letter case of response header key. */
  preserveHeaderKeyCase?: boolean;
  /** Basic authentication i.e. 'user:password' to compute an Authorization header. */
  auth?: string;
  /** Rewrites the location hostname on (301/302/307/308) redirects. Default: null. */
  hostRewrite?: string;
  /** Rewrites the location host/port on (301/302/307/308) redirects based on requested host/port. Default: false. */
  autoRewrite?: boolean;
  /** Rewrites the location protocol on (301/302/307/308) redirects to 'http' or 'https'. Default: null. */
  protocolRewrite?: string;
  /** Rewrites domain of set-cookie headers. */
  cookieDomainRewrite?: false | string | { [oldDomain: string]: string };
  /** Rewrites path of set-cookie headers. Default: false. */
  cookiePathRewrite?: false | string | { [oldPath: string]: string };
  /** Object with extra headers to be added to target requests. */
  headers?: { [header: string]: string };
  /** Timeout (in milliseconds) when proxy receives no response from target. Default: 120000 (2 minutes). */
  proxyTimeout?: number;
  /** Timeout (in milliseconds) for incoming requests. */
  timeout?: number;
  /** Specify whether you want to follow redirects. Default: false. */
  followRedirects?: boolean;
  /** If set to true, none of the webOutgoing passes are called and it's your responsibility to appropriately return the response by listening and acting on the proxyRes event. */
  selfHandleResponse?: boolean;
  /** Buffer. */
  buffer?: Stream;
  /** Explicitly set the method type of the ProxyReq. */
  method?: string;
  /** CA certificate for SSL. */
  ca?: string | Buffer | Array<string | Buffer>;
}

export type ErrorCallback<
  TError = Error,
  TIncomingMessage = IncomingMessage,
  TServerResponse = ServerResponse,
> = (
  err: TError,
  req: TIncomingMessage,
  res: TServerResponse | Socket,
  target?: ProxyTargetUrl,
) => void;

export type StartCallback<
  TIncomingMessage = IncomingMessage,
  TServerResponse = ServerResponse,
> = (
  req: TIncomingMessage,
  res: TServerResponse,
  target: ProxyTargetUrl,
) => void;

export type ProxyReqCallback<
  TClientRequest = ClientRequest,
  TIncomingMessage = IncomingMessage,
  TServerResponse = ServerResponse,
> = (
  proxyReq: TClientRequest,
  req: TIncomingMessage,
  res: TServerResponse,
  options: ServerOptions,
) => void;

export type ProxyResCallback<
  TIncomingMessage = IncomingMessage,
  TServerResponse = ServerResponse,
> = (
  proxyRes: TIncomingMessage,
  req: TIncomingMessage,
  res: TServerResponse,
) => void;

export type EconnresetCallback<
  TError = Error,
  TIncomingMessage = IncomingMessage,
  TServerResponse = ServerResponse,
> = (
  err: TError,
  req: TIncomingMessage,
  res: TServerResponse,
  target: ProxyTargetUrl,
) => void;

export type EndCallback<
  TIncomingMessage = IncomingMessage,
  TServerResponse = ServerResponse,
> = (
  req: TIncomingMessage,
  res: TServerResponse,
  proxyRes: TIncomingMessage,
) => void;

export type ProxyPass = (
  req: IncomingMessage,
  res: ServerResponse,
  options: ServerOptions,
  head: Buffer | undefined,
  server: any,
  clb?: ErrorCallback,
) => boolean | void;
