export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

let minimumLevel: LogLevel = __DEV__ ? 'debug' : 'info';
const ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function setLogLevel(level: LogLevel): void {
  minimumLevel = level;
}

export function createLogger(scope: string): Logger {
  const write = (level: LogLevel, message: string, args: unknown[]) => {
    if (ORDER[level] < ORDER[minimumLevel]) return;
    const line = `[${scope}] ${message}`;
    switch (level) {
      case 'debug':
        console.debug(line, ...args);
        break;
      case 'info':
        console.info(line, ...args);
        break;
      case 'warn':
        console.warn(line, ...args);
        break;
      case 'error':
        console.error(line, ...args);
        break;
    }
  };
  return {
    debug: (m, ...a) => write('debug', m, a),
    info: (m, ...a) => write('info', m, a),
    warn: (m, ...a) => write('warn', m, a),
    error: (m, ...a) => write('error', m, a),
  };
}

declare const __DEV__: boolean;
