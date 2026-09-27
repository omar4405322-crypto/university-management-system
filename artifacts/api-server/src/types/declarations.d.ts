declare module 'kill-port' {
  export default function killPort(port: number, protocol?: 'tcp' | 'udp'): Promise<void>;
}
