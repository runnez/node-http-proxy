declare module 'sse' {
  import type { Server } from 'http';
  class SSE {
    constructor(server: Server, options?: { path?: string });
    on(event: string, callback: (...args: any[]) => void): void;
  }
  export default SSE;
}

declare module 'concat-stream' {
  function concat(callback: (body: Buffer) => void): NodeJS.WritableStream;
  export default concat;
}

declare module 'async' {
  function parallel(tasks: Array<(callback: (err?: any) => void) => void>, callback?: (err?: any) => void): void;
  export { parallel };
  export default { parallel };
}
