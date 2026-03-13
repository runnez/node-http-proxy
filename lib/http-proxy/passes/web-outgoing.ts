import type { IncomingMessage, ServerResponse } from 'http';
import * as common from '../common.js';
import type { ProxyServerOptions } from '../../types.js';

const redirectRegex = /^201|30(1|2|7|8)$/;

/**
 * If is a HTTP 1.0 request, remove chunk headers
 */
export function removeChunked(req: IncomingMessage, res: ServerResponse, proxyRes: IncomingMessage): void {
  if (req.httpVersion === '1.0') {
    delete proxyRes.headers['transfer-encoding'];
  }
}

/**
 * If is a HTTP 1.0 request, set the correct connection header
 * or if connection header not present, then use `keep-alive`
 */
export function setConnection(req: IncomingMessage, res: ServerResponse, proxyRes: IncomingMessage): void {
  if (req.httpVersion === '1.0') {
    proxyRes.headers.connection = req.headers.connection || 'close';
  } else if (req.httpVersion !== '2.0' && !proxyRes.headers.connection) {
    proxyRes.headers.connection = req.headers.connection || 'keep-alive';
  }
}

export function setRedirectHostRewrite(
  req: IncomingMessage,
  res: ServerResponse,
  proxyRes: IncomingMessage,
  options: ProxyServerOptions,
): void {
  if ((options.hostRewrite || options.autoRewrite || options.protocolRewrite)
      && proxyRes.headers['location']
      && redirectRegex.test(String(proxyRes.statusCode))) {
    const target = new URL(options.target as string);
    const u = new URL(proxyRes.headers['location']);

    if (target.host !== u.host) {
      return;
    }

    if (options.hostRewrite) {
      u.host = options.hostRewrite;
    } else if (options.autoRewrite) {
      u.host = req.headers['host'] || '';
    }
    if (options.protocolRewrite) {
      u.protocol = options.protocolRewrite;
    }

    proxyRes.headers['location'] = u.href;
  }
}

/**
 * Copy headers from proxyResponse to response,
 * set each header in response object.
 */
export function writeHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  proxyRes: IncomingMessage,
  options: ProxyServerOptions,
): void {
  let rewriteCookieDomainConfig = options.cookieDomainRewrite;
  let rewriteCookiePathConfig = options.cookiePathRewrite;
  const preserveHeaderKeyCase = options.preserveHeaderKeyCase;
  let rawHeaderKeyMap: Record<string, string> | undefined;
  const setHeader = (key: string, header: string | string[] | undefined) => {
    if (header == undefined) return;
    if (rewriteCookieDomainConfig && key.toLowerCase() === 'set-cookie') {
      header = common.rewriteCookieProperty(header, rewriteCookieDomainConfig as Record<string, string>, 'domain') as string | string[];
    }
    if (rewriteCookiePathConfig && key.toLowerCase() === 'set-cookie') {
      header = common.rewriteCookieProperty(header, rewriteCookiePathConfig as Record<string, string>, 'path') as string | string[];
    }
    res.setHeader(String(key).trim(), header);
  };

  if (typeof rewriteCookieDomainConfig === 'string') {
    rewriteCookieDomainConfig = { '*': rewriteCookieDomainConfig };
  }

  if (typeof rewriteCookiePathConfig === 'string') {
    rewriteCookiePathConfig = { '*': rewriteCookiePathConfig };
  }

  if (preserveHeaderKeyCase && proxyRes.rawHeaders != undefined) {
    rawHeaderKeyMap = {};
    for (let i = 0; i < proxyRes.rawHeaders.length; i += 2) {
      const key = proxyRes.rawHeaders[i];
      rawHeaderKeyMap[key.toLowerCase()] = key;
    }
  }

  Object.keys(proxyRes.headers).forEach((key) => {
    let header = proxyRes.headers[key];
    if (preserveHeaderKeyCase && rawHeaderKeyMap) {
      key = rawHeaderKeyMap[key] || key;
    }
    setHeader(key, header);
  });
}

/**
 * Set the statusCode from the proxyResponse
 */
export function writeStatusCode(req: IncomingMessage, res: ServerResponse, proxyRes: IncomingMessage): void {
  if (proxyRes.statusMessage) {
    res.statusCode = proxyRes.statusCode!;
    res.statusMessage = proxyRes.statusMessage;
  } else {
    res.statusCode = proxyRes.statusCode!;
  }
}
