import * as net from 'net';
import * as dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const REMOTE_HOST = 'ep-gentle-art-amud0qm0.us-east-1.aws.neon.tech';
const REMOTE_PORT = 5432;
const LOCAL_PORT = 5433;

dns.resolve4(REMOTE_HOST, (err, addresses) => {
  if (err || !addresses.length) {
    console.error('Failed to resolve host:', err);
    process.exit(1);
  }

  const remoteIp = addresses[0];
  console.log(`Resolved ${REMOTE_HOST} to ${remoteIp}`);

  const server = net.createServer((socket) => {
    console.log('New connection to proxy');
    const remoteSocket = net.connect(REMOTE_PORT, remoteIp, () => {
      socket.pipe(remoteSocket);
      remoteSocket.pipe(socket);
    });

    remoteSocket.on('error', (err) => {
      console.error('Remote socket error:', err);
      socket.destroy();
    });

    socket.on('error', (err) => {
      console.error('Local socket error:', err);
      remoteSocket.destroy();
    });
  });

  server.listen(LOCAL_PORT, '127.0.0.1', () => {
    console.log(`Proxy listening on 127.0.0.1:${LOCAL_PORT}`);
    console.log(`Point your DATABASE_URL to: postgresql://neondb_owner:npg_2CAM0ErmeTbP@127.0.0.1:5433/neondb?sslmode=require`);
  });
});
