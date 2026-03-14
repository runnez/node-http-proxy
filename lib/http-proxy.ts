import ProxyServer from './http-proxy/index';
import type { ProxyServerOptions } from './types';

function createProxyServer(options?: ProxyServerOptions): ProxyServer {
  return new ProxyServer(options);
}

ProxyServer.createProxyServer = createProxyServer;
ProxyServer.createServer      = createProxyServer;
ProxyServer.createProxy       = createProxyServer;

export default ProxyServer;
