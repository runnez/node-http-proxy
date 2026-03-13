import ProxyServer from './http-proxy/index.js';
import type { ProxyServerOptions } from './types.js';

function createProxyServer(options?: ProxyServerOptions): ProxyServer {
  return new ProxyServer(options);
}

ProxyServer.createProxyServer = createProxyServer;
ProxyServer.createServer      = createProxyServer;
ProxyServer.createProxy       = createProxyServer;

export default ProxyServer;
