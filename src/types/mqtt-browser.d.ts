declare module 'mqtt/dist/mqtt' {
  export interface IClientOptions {
    username?: string;
    password?: string;
    reconnectPeriod?: number;
    connectTimeout?: number;
    clientId?: string;
  }

  export interface MqttClient {
    on: (event: string, handler: (...args: any[]) => void) => void;
    once: (event: string, handler: (...args: any[]) => void) => void;
    subscribe: (topics: string[]) => void;
    publish: (
      topic: string,
      message: string,
      options?: Record<string, unknown>,
      callback?: (error?: Error | null) => void,
    ) => void;
    end: (force?: boolean) => void;
  }

  export function connect(url: string, options?: IClientOptions): MqttClient;
}
