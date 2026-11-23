// Optional same-origin socket transport; normal HTTP remains the failure path.
export type LiveTransport = (path: string, body: unknown) => Promise<Response> | undefined;
let live: LiveTransport | undefined;
export const setLiveTransport = (next?: LiveTransport) => {
  live = next;
};
export const liveRequest = (path: string, body: unknown) => live?.(path, body);
