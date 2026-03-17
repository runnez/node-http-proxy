declare module 'follow-redirects' {
  import type * as http from 'http';
  import type * as https from 'https';

  export const http: typeof import('http');
  export const https: typeof import('https');
}
