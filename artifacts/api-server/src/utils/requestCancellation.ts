import type { Request, Response } from 'express';

export interface RequestCancellationOptions {
  timeoutMs?: number;
}

/**
 * Creates an AbortController that aborts ONLY when the client connection
 * prematurely terminates before the HTTP response has finished writing.
 *
 * On modern Node.js versions, incoming request stream (IncomingMessage)
 * emits 'close' when the request body has finished reading. Listening to req.on('close')
 * prematurely aborts in-flight AI provider requests on normal POST completion!
 *
 * Instead, we observe the response/socket lifecycle (`res.on('close')`), checking
 * `res.writableEnded` / `res.finished` to distinguish normal completed requests from
 * premature client disconnects.
 */
export function createClientDisconnectAbortController(
  req: Request,
  res: Response,
  options: RequestCancellationOptions = {},
): { abortController: AbortController; cleanup: () => void } {
  const abortController = new AbortController();

  const handleResponseClose = () => {
    // If the response has already ended or finished writing, this is normal lifecycle completion.
    // Only abort if the connection closed while the response was still pending.
    if (!res.writableEnded && !res.finished) {
      if (!abortController.signal.aborted) {
        abortController.abort(new Error('CLIENT_DISCONNECTED'));
      }
    }
  };

  res.on('close', handleResponseClose);

  // If the underlying response TCP socket was already destroyed before execution began
  if (res.socket?.destroyed && !res.writableEnded && !res.finished) {
    if (!abortController.signal.aborted) {
      abortController.abort(new Error('CLIENT_DISCONNECTED'));
    }
  }

  let timeoutId: NodeJS.Timeout | undefined;
  if (options.timeoutMs && options.timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      if (!abortController.signal.aborted && !res.writableEnded && !res.finished) {
        abortController.abort(new Error('REQUEST_TIMEOUT'));
      }
    }, options.timeoutMs);
    timeoutId.unref?.();
  }

  const cleanup = () => {
    res.removeListener('close', handleResponseClose);
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  return { abortController, cleanup };
}
