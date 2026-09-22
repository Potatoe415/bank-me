const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("===================================================");
console.log("   Démarrage automatisé de Bank-Me (Tunnel + App)  ");
console.log("===================================================\n");

console.log("[1/3] Lancement du tunnel Cloudflare...");
const cloudflared = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3004']);

let tunnelUrl = '';
let nextServer = null;

cloudflared.stderr.on('data', (data) => {
  const output = data.toString();
  // Cherche l'URL trycloudflare
  const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  
  if (match && !tunnelUrl) {
    tunnelUrl = match[0];
    console.log(`\n[SUCCESS] Tunnel Cloudflare actif : ${tunnelUrl}`);
    
    // Mettre à jour .env.local
    console.log("[2/3] Mise à jour automatique de .env.local avec l'URL du tunnel...");
    const envPath = path.join(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(
        /NEXT_PUBLIC_APP_URL=.*/,
        `NEXT_PUBLIC_APP_URL=${tunnelUrl}`
      );
      fs.writeFileSync(envPath, envContent);
      console.log(`[SUCCESS] .env.local mis à jour avec NEXT_PUBLIC_APP_URL=${tunnelUrl}`);
    } else {
      console.error("[ERROR] Fichier .env.local introuvable !");
    }

    // Démarrer Next.js
    console.log("\n[3/3] Lancement du serveur de développement Next.js...");
    nextServer = spawn('npm', ['run', 'dev'], { shell: true, stdio: 'inherit', env: { ...process.env, PORT: '3004' } });
    
    console.log("\n===================================================");
    console.log(` L'application est prête !`);
    console.log(` URL locale : http://localhost:3004`);
    console.log(` URL publique (OAuth) : ${tunnelUrl}`);
    console.log("===================================================\n");
    
    // Attendre un peu que Next.js compile, puis ouvrir le navigateur
    setTimeout(() => {
      console.log("=> Ouverture automatique du navigateur...");
      const { exec } = require('child_process');
      exec('start http://localhost:3004');
    }, 3500);
  }
});

cloudflared.on('close', (code) => {
  console.log(`Le tunnel Cloudflare s'est arrêté (code ${code}).`);
  if (nextServer) nextServer.kill();
});

process.on('SIGINT', () => {
  console.log("\nArrêt des services...");
  cloudflared.kill();
  if (nextServer) nextServer.kill();
  process.exit();
});
