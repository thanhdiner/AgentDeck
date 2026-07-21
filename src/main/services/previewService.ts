import http from 'node:http';

export type DevServerInfo = {
  port: number;
  url: string;
  name: string;
  status: 'online' | 'error';
};

const COMMON_PORTS = [3000, 3001, 3333, 4173, 4200, 5173, 5174, 5000, 8000, 8080, 8888, 9000];

function probePort(port: number): Promise<DevServerInfo | null> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, { timeout: 800 }, (res) => {
      const statusCode = res.statusCode ?? 0;
      if (statusCode >= 200 && statusCode < 400) {
        const poweredBy = res.headers['x-powered-by'] || '';
        const serverHeader = res.headers['server'] || '';
        let name = 'Dev Server';
        if (typeof poweredBy === 'string' && poweredBy) {
          name = poweredBy;
        } else if (typeof serverHeader === 'string' && serverHeader) {
          name = serverHeader;
        }
        // Consume the response to free the socket
        res.resume();
        resolve({ port, url: `http://localhost:${port}`, name, status: 'online' });
      } else {
        res.resume();
        resolve(null);
      }
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

export async function detectDevServers(): Promise<DevServerInfo[]> {
  const results = await Promise.all(COMMON_PORTS.map(probePort));
  return results.filter((r): r is DevServerInfo => r !== null);
}
