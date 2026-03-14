import url from 'url';
import required from 'requires-port';
import type { IncomingMessage } from 'http';
import type { ProxyServerOptions, ProxyTargetUrl } from '../types';

const upgradeHeader = /(^|,)\s*upgrade\s*($|,)/i;

export const isSSL = /^https/;

export interface OutgoingOptions {
  host?: string;
  hostname?: string;
  socketPath?: string;
  port?: number | string;
  method?: string;
  path?: string;
  headers: Record<string, string | string[] | undefined>;
  auth?: string;
  agent?: import('http').Agent | false;
  localAddress?: string;
  rejectUnauthorized?: boolean;
  pfx?: string | Buffer;
  key?: string | Buffer;
  passphrase?: string;
  cert?: string | Buffer;
  ca?: string | Buffer | Array<string | Buffer>;
  ciphers?: string;
  secureProtocol?: string;
  [key: string]: unknown;
}

/**
 * Copies the right headers from `options` and `req` to
 * `outgoing` which is then used to fire the proxied
 * request.
 */
export function setupOutgoing(
  outgoing: OutgoingOptions,
  options: ProxyServerOptions,
  req: IncomingMessage,
  forward?: string,
): OutgoingOptions {
  const forwardOrTarget = forward || 'target';
  const target = options[forwardOrTarget as keyof ProxyServerOptions] as ProxyTargetUrl;

  outgoing.port = target.port ||
                  (isSSL.test(target.protocol ?? '') ? 443 : 80);

  (['host', 'hostname', 'socketPath', 'pfx', 'key',
    'passphrase', 'cert', 'ca', 'ciphers', 'secureProtocol'] as const).forEach(
    (e) => { (outgoing as any)[e] = (target as any)[e]; }
  );

  outgoing.method = options.method || req.method;
  outgoing.headers = Object.assign({}, req.headers) as Record<string, string | string[] | undefined>;

  if (options.headers) {
    Object.assign(outgoing.headers, options.headers);
  }

  if (options.auth) {
    outgoing.auth = options.auth;
  }

  if (options.ca) {
    outgoing.ca = options.ca;
  }

  if (isSSL.test(target.protocol ?? '')) {
    outgoing.rejectUnauthorized = (typeof options.secure === 'undefined') ? true : options.secure;
  }

  outgoing.agent = options.agent || false;
  outgoing.localAddress = options.localAddress;

  //
  // Remark: If we are false and not upgrading, set the connection: close. This is the right thing to do
  // as node core doesn't handle this COMPLETELY properly yet.
  //
  if (!outgoing.agent) {
    outgoing.headers = outgoing.headers || {};
    if (typeof outgoing.headers.connection !== 'string'
        || !upgradeHeader.test(outgoing.headers.connection)
       ) { outgoing.headers.connection = 'close'; }
  }

  const targetPath = target && options.prependPath !== false
    ? (target.path ?? ((target.pathname || '') + (target.search || '')))
    : '';

  //
  // Remark: Can we somehow not use url.parse as a perf optimization?
  //
  let outgoingPath = !options.toProxy
    ? (url.parse(req.url || '').path || '')
    : (req.url || '');

  //
  // Remark: ignorePath will just straight up ignore whatever the request's
  // path is. This can be labeled as FOOT-GUN material if you do not know what
  // you are doing and are using conflicting options.
  //
  outgoingPath = !options.ignorePath ? outgoingPath : '';

  outgoing.path = urlJoin(targetPath, outgoingPath);

  if (options.changeOrigin) {
    outgoing.headers.host =
      required(outgoing.port as string | number, target.protocol ?? '') && !hasPort(outgoing.host || '')
        ? outgoing.host + ':' + outgoing.port
        : outgoing.host;
  }
  return outgoing;
}

/**
 * Get the port number from the host. Or guess it based on the connection type.
 */
export function getPort(req: IncomingMessage): string {
  const res = req.headers.host ? req.headers.host.match(/:(\d+)/) : '';

  return res ?
    res[1] :
    hasEncryptedConnection(req) ? '443' : '80';
}

/**
 * Check if the request has an encrypted connection.
 */
export function hasEncryptedConnection(req: IncomingMessage): boolean {
  const socket = (req as any).socket || (req as any).connection || {};
  return Boolean(socket.encrypted || socket.pair);
}

/**
 * OS-agnostic join (doesn't break on URLs like path.join does on Windows).
 */
export function urlJoin(...args: string[]): string {
  const lastIndex = args.length - 1;
  const last = args[lastIndex];
  const lastSegs = last.split('?');

  args[lastIndex] = lastSegs.shift()!;

  const retSegs: string[] = [
    args.filter(Boolean).join('/')
        .replace(/\/+/g, '/')
        .replace('http:/', 'http://')
        .replace('https:/', 'https://')
  ];

  retSegs.push(...lastSegs);

  return retSegs.join('?');
}

/**
 * Rewrites or removes the domain of a cookie header.
 */
export function rewriteCookieProperty(
  header: string | string[],
  config: Record<string, string | null>,
  property: string,
): string | string[] {
  if (Array.isArray(header)) {
    return header.map((headerElement) => {
      return rewriteCookieProperty(headerElement, config, property) as string;
    });
  }
  return header.replace(
    new RegExp('(;\\s*' + property + '=)([^;]+)', 'i'),
    (match: string, prefix: string, previousValue: string) => {
      let newValue: string | null | undefined;
      if (previousValue in config) {
        newValue = config[previousValue];
      } else if ('*' in config) {
        newValue = config['*'];
      } else {
        return match;
      }
      if (newValue) {
        return prefix + newValue;
      } else {
        return '';
      }
    },
  );
}

/**
 * Check the host and see if it potentially has a port in it (keep it simple).
 */
function hasPort(host: string): boolean {
  return !!~host.indexOf(':');
}
