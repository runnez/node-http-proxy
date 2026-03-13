import type { IncomingMessage, ServerResponse, Agent } from 'http';
import type { SecureContextOptions } from 'tls';

export interface ProxyTargetUrl {
  protocol?: string;
  host?: string;
  hostname?: string;
  port?: number | string;
  path?: string;
  pathname?: string;
  search?: string;
  socketPath?: string;
  pfx?: string | Buffer;
  key?: string | Buffer;
  passphrase?: string;
  cert?: string | Buffer;
  ca?: string | Buffer;
  ciphers?: string;
  secureProtocol?: string;
}

export interface ProxyServerOptions {
  target?: string | ProxyTargetUrl;
  forward?: string | ProxyTargetUrl;
  ssl?: SecureContextOptions;
  xfwd?: boolean;
  secure?: boolean;
  toProxy?: boolean;
  prependPath?: boolean;
  ignorePath?: boolean;
  changeOrigin?: boolean;
  auth?: string;
  hostRewrite?: string;
  autoRewrite?: boolean;
  protocolRewrite?: string;
  cookieDomainRewrite?: string | Record<string, string>;
  cookiePathRewrite?: string | Record<string, string>;
  headers?: Record<string, string>;
  method?: string;
  timeout?: number;
  proxyTimeout?: number;
  followRedirects?: boolean;
  selfHandleResponse?: boolean;
  buffer?: NodeJS.ReadableStream;
  agent?: Agent | false;
  localAddress?: string;
  preserveHeaderKeyCase?: boolean;
  ca?: string | Buffer | Array<string | Buffer>;
}

export type ProxyPass = (
  req: IncomingMessage,
  res: ServerResponse,
  options: ProxyServerOptions,
  head?: Buffer,
  server?: any,
  clb?: ErrorCallback,
) => boolean | void;

export type OutgoingPass = (
  req: IncomingMessage,
  res: ServerResponse,
  proxyRes: IncomingMessage,
  options: ProxyServerOptions,
) => boolean | void;

export type ErrorCallback = (
  err: Error,
  req: IncomingMessage,
  res: ServerResponse,
  target?: ProxyTargetUrl,
) => void;
