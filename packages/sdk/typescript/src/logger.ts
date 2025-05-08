import winston, { format } from 'winston';

const { combine, timestamp, printf, colorize } = format; // 解构 format 中的方法

export const logger = winston.createLogger({
  level: 'debug', // Default level
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console() // Default transport
  ],
});

/**
 * Sets the transports for the global logger.
 * This will remove all existing transports and add the new ones.
 * @param transports Array of Winston transports.
 */
export function setLoggerTransports(transports: winston.transport[]): void {
  // Remove existing transports
  // Iterating backwards and removing is safer if the transports array is modified during iteration by winston itself,
  // though for winston.logger.transports, it's typically a direct array manipulation.
  while (logger.transports.length > 0) {
    logger.remove(logger.transports[0]);
  }

  // Add new transports
  transports.forEach(transport => {
    logger.add(transport);
  });
}

/**
 * Sets the level for the global logger.
 * @param level The logging level (e.g., 'info', 'debug', 'warn', 'error').
 */
export function setLoggerLevel(level: string): void {
  logger.level = level;
}

