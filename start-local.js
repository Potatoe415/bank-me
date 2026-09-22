const { spawn } = require('child_process');
const { exec } = require('child_process');

const PORT = 3000;

console.log("===================================================");
console.log(`   Bank-Me — Dev local (port ${PORT}, sans tunnel)  `);
console.log("===================================================\n");

console.log(`[1/1] Lancement du serveur de développement Next.js sur le port ${PORT}...`);

const nextServer = spawn('npm', ['run', 'dev'], {
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, PORT: String(PORT) },
});

// Ouvrir le navigateur après 3,5 s (temps de compilation initiale)
setTimeout(() => {
  console.log(`\n=> Ouverture automatique du navigateur sur http://localhost:${PORT}`);
  exec(`start http://localhost:${PORT}`);
}, 3500);

nextServer.on('close', (code) => {
  console.log(`\nServeur Next.js arrêté (code ${code}).`);
});

process.on('SIGINT', () => {
  console.log('\nArrêt du serveur...');
  nextServer.kill();
  process.exit();
});
