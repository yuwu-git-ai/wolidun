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
    `if [ -d /root/app/.git ]; then cd /root/app && git pull origin master; else cp -r /root/app/data /tmp/app-data-backup 2>/dev/null; rm -rf /root/app && git clone https://github.com/yuwu-git-ai/wolidun.git /root/app && cd /root/app && cp -r /tmp/app-data-backup data 2>/dev/null; fi`,
    `cd /root/app`,
    `[ ! -f .env ] && printf 'PORT=3001\nJWT_SECRET=7937d3c836245c066ddea61d25e0b103466598a59ccc6eab1dc5937699752b9c\nADMIN_KEY=admin123\nDB_PATH=/app/data/ordering.db\n' > .env`,
    `mkdir -p data`,
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
