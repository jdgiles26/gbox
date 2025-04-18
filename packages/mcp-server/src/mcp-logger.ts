import type { Logger } from "./sdk/types";

export class MCPLogger implements Logger {
  constructor() {}

  debug(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const level = "DEBUG";
    const formattedMessage = this.format(message, ...args);
    console.debug(`[${timestamp}][${level}] ${formattedMessage}`);
  }

  info(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const level = "INFO";
    const formattedMessage = this.format(message, ...args);
    console.info(`[${timestamp}][${level}] ${formattedMessage}`);
  }

  warn(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const level = "WARN";
    const formattedMessage = this.format(message, ...args);
    console.warn(`[${timestamp}][${level}] ${formattedMessage}`);
  }

  error(message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const level = "ERROR";
    const formattedMessage = this.format(message, ...args);
    console.error(`[${timestamp}][${level}] ${formattedMessage}`);
  }

  private format(message: string, ...args: any[]): string {
    if (args.length === 0) return message;

    try {
      return args.reduce((msg, arg) => {
        if (typeof arg === "object") {
          // Use JSON.stringify for objects passed to format
          // console itself might handle objects better, but this ensures consistency if format is used elsewhere
          try {
            return msg.replace("%o", JSON.stringify(arg));
          } catch (e) {
            return msg.replace("%o", "[Unserializable Object]");
          }
        }
        return msg.replace(/%[sdfo]/, String(arg));
      }, message);
    } catch (error) {
      console.error("Error formatting log message:", error);
      return message;
    }
  }
}
