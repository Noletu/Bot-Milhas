import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(level: string, runId: string): Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  const base = { level, base: { runId } };

  if (isDev) {
    return pino({
      ...base,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
    });
  }
  return pino(base);
}
