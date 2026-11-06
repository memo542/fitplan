import http from 'node:http';
import { readFile } from 'node:fs/promises';
const assets = { '/': ['index.html','text/html'], '/index.html': ['index.html','text/html'], '/style.css': ['style.css','text/css'], '/app.js': ['app.js','text/javascript'] };
const server = http.createServer(async (req, res) => {
  const asset = assets[new URL(req.url, 'http://localhost').pathname];
  if (!asset) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(new URL('./dist/' + asset[0], import.meta.url));
    res.writeHead(200, {'Content-Type': asset[1] + '; charset=utf-8', 'Cache-Control': 'no-store'});
    res.end(body);
  } catch { res.writeHead(500); res.end('Unable to read page file'); }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? '端口 5173 已被占用，请关闭此前启动的服务后重试。' : error.message); process.exitCode = 1; });
server.listen(5173, '127.0.0.1', () => console.log('Fitplan 已启动：http://127.0.0.1:5173'));
