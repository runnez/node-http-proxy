import httpNative from 'http';
import httpsNative from 'https';
import type { IncomingMessage, ServerResponse, ClientRequest } from 'http';
import * as web_o_module from './web-outgoing';
import * as common from '../common';
import followRedirects from 'follow-redirects';
import type { ServerOptions, ProxyTargetUrl, ErrorCallback } from '../../types';
import type ProxyServer from '../index';

type OutgoingPass = (
  req: IncomingMessage,
  res: ServerResponse,
  proxyRes: IncomingMessage,
  options: ServerOptions,
) => boolean | void;

const web_o: OutgoingPass[] = Object.keys(web_o_module).map(
  (pass) => web_o_module[pass as keyof typeof web_o_module] as OutgoingPass
);

const nativeAgents = { http: httpNative, https: httpsNative };

/**
 * Sets `content-length` to '0' if request is of DELETE type.
 */
export function deleteLength(req: IncomingMessage, res: ServerResponse, options: ServerOptions): void {
  if ((req.method === 'DELETE' || req.method === 'OPTIONS')
     && !req.headers['content-length']) {
    req.headers['content-length'] = '0';
    delete req.headers['transfer-encoding'];
  }
}

/**
 * Sets timeout in request socket if it was specified in options.
 */
export function timeout(req: IncomingMessage, res: ServerResponse, options: ServerOptions): void {
  if (options.timeout) {
    req.socket.setTimeout(options.timeout);
  }
}

/**
 * Sets `x-forwarded-*` headers if specified in config.
 */
export function XHeaders(req: IncomingMessage, res: ServerResponse, options: ServerOptions): void {
  if (!options.xfwd) return;

  const encrypted = (req as any).isSpdy || common.hasEncryptedConnection(req);
  const values: Record<string, string | undefined> = {
    for  : req.socket.remoteAddress,
    port : common.getPort(req),
    proto: encrypted ? 'https' : 'http'
  };

  ['for', 'port', 'proto'].forEach((header) => {
    req.headers['x-forwarded-' + header] =
      (req.headers['x-forwarded-' + header] || '') +
      (req.headers['x-forwarded-' + header] ? ',' : '') +
      values[header];
  });

  req.headers['x-forwarded-host'] = req.headers['x-forwarded-host'] as string || req.headers['host'] || '';
}

/**
 * Does the actual proxying. If `forward` is enabled fires up
 * a ForwardStream, same happens for ProxyStream. The request
 * just dies otherwise.
 */
export function stream(
  req: IncomingMessage,
  res: ServerResponse,
  options: ServerOptions,
  _: unknown,
  server: ProxyServer,
  clb?: ErrorCallback,
): void {
  server.emit('start', req, res, (options.target || options.forward) as ProxyTargetUrl);

  const agents = options.followRedirects ? followRedirects : nativeAgents;
  const http = agents.http;
  const https = agents.https;

  if (options.forward) {
    const forwardTarget = options.forward as ProxyTargetUrl;
    const forwardReq = (forwardTarget.protocol === 'https:' ? https : http).request(
      common.setupOutgoing(options.ssl || {} as any, options, req, 'forward') as any
    );

    const forwardError = createErrorHandler(forwardReq, forwardTarget);
    req.on('error', forwardError);
    forwardReq.on('error', forwardError);

    ((options.buffer || req) as NodeJS.ReadableStream).pipe(forwardReq);
    if (!options.target) { res.end(); return; }
  }

  const target = options.target as ProxyTargetUrl;
  const proxyReq = (target.protocol === 'https:' ? https : http).request(
    common.setupOutgoing(options.ssl || {} as any, options, req) as any
  );

  proxyReq.on('socket', (_socket) => {
    if (server && !proxyReq.getHeader('expect')) {
      server.emit('proxyReq', proxyReq, req, res, options);
    }
  });

  if (options.proxyTimeout) {
    proxyReq.setTimeout(options.proxyTimeout, () => {
       proxyReq.destroy();
    });
  }

  req.socket.on('close', () => {
    if (!res.writableFinished && !proxyReq.destroyed) {
      const err: NodeJS.ErrnoException = new Error('socket hang up');
      err.code = 'ECONNRESET';
      proxyReq.destroy(err);
    }
  });

  const proxyError = createErrorHandler(proxyReq, target);
  req.on('error', proxyError);
  proxyReq.on('error', proxyError);

  function createErrorHandler(proxyReq: ClientRequest, url: ProxyTargetUrl) {
    return function proxyError(err: NodeJS.ErrnoException) {
      if (req.socket.destroyed && err.code === 'ECONNRESET') {
        server.emit('econnreset', err, req, res, url);
        return proxyReq.destroy();
      }

      if (clb) {
        clb(err, req, res, url);
      } else {
        server.emit('error', err, req, res, url);
      }
    };
  }

  ((options.buffer || req) as NodeJS.ReadableStream).pipe(proxyReq);

  proxyReq.on('response', (proxyRes: IncomingMessage) => {
    if (server) { server.emit('proxyRes', proxyRes, req, res); }

    if (!res.headersSent && !options.selfHandleResponse) {
      for (let i = 0; i < web_o.length; i++) {
        if (web_o[i](req, res, proxyRes, options)) { break; }
      }
    }

    if (!res.writableEnded) {
      proxyRes.on('end', () => {
        if (server) server.emit('end', req, res, proxyRes);
      });
      if (!options.selfHandleResponse) proxyRes.pipe(res);
    } else {
      if (server) server.emit('end', req, res, proxyRes);
    }
  });
}
