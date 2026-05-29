// #book ch16-graceful-shutdown

// ch16-multi-agent/server/src/lib/agent/multi/graceful-shutdown.ts
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

  // 超时自动中止
  const timeoutId = setTimeout(() => {
    controller.abort('TIMEOUT');
    onTimeout?.();
  }, timeoutMs);

  // 进程信号中止
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
      console.log(`任务已中止：${controller.signal.reason}`);
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    process.removeListener('SIGTERM', handleSignal);
    process.removeListener('SIGINT', handleSignal);
  }
}
// #endbook
