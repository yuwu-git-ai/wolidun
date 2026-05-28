const { Client } = require('ssh2');

const CONFIG = {
  host: '47.121.198.81',
  port: 22,
  username: 'root',
  password: 'QWErty83513721abc',
};

const conn = new Client();

conn.on('ready', () => {
  console.log('[SSH] Connected');

  const commands = [
    `cd /root/app`,
    `if git remote -v | grep -q origin; then git pull origin master; else echo "No git remote, using existing code"; fi`,
    `docker compose down`,
    `docker compose up -d --build 2>&1`,
  ].join(' && ');

  console.log('[EXEC] Rebuilding...');
  conn.exec(commands, { timeout: 300000 }, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }

    stream.on('data', (data) => { process.stdout.write(data.toString()); });
    stream.stderr.on('data', (data) => { process.stderr.write('STDERR: ' + data.toString()); });
    stream.on('close', (code) => {
      console.log(`\n[EXEC] Exit code: ${code}`);

      // Verify
      conn.exec('curl -s http://localhost:3001/api/health', (err, stream) => {
        if (err) { console.error(err); conn.end(); return; }
        stream.on('data', (data) => { console.log('[HEALTH] ' + data.toString()); });
        stream.on('close', () => conn.end());
      });
    });
  });
});

conn.on('error', (err) => { console.error('[SSH] Error:', err); process.exit(1); });
conn.connect(CONFIG);
