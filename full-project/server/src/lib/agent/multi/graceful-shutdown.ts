// #book-ref ch16-multi-agent/server/src/lib/agent/multi/graceful-shutdown.ts

export async function runWithGracefulShutdown<T>(
  work: (signal: AbortSignal) => Promise<T>,
  options: {
    timeoutMs?: number;
    onTimeout?: () => void;
    onAbort?: () => void;
  } = {},
): Promise<T | null> {
  const controller = new AbortController();
  const { timeoutMs = 300_000, onTimeout, onAbort } = options;

  // Auto-abort on timeout
  const timeoutId = setTimeout(() => {
    controller.abort('TIMEOUT');
    onTimeout?.();
  }, timeoutMs);

  // Abort on process signal
  const handleSignal = () => {
    controller.abort('SIGTERM');
    onAbort?.();
  };
  process.once('SIGTERM', handleSignal);
  process.once('SIGINT', handleSignal);

  try {
    return await work(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      console.log(`Task aborted: ${controller.signal.reason}`);
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    process.removeListener('SIGTERM', handleSignal);
    process.removeListener('SIGINT', handleSignal);
  }
}
