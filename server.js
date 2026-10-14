const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir les fichiers statiques (index.html, etc.)
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Gestion des états du jeu
let waitingPlayers = [];
let activeDuels = {};
let globalLeaderboard = [];

io.on('connection', (socket) => {
  console.log(`Joueur connecté : ${socket.id}`);

  // Inscription / Connexion du joueur
  socket.on('joinLobby', (data) => {
    socket.userData = {
      id: socket.id,
      pseudo: data.pseudo || 'Anonyme',
      flag: data.flag || '🏴‍☠️',
      aura: 1000
    };
    
    // Ajout à la file d'attente
    waitingPlayers.push(socket);
    socket.emit('lobbyStatus', { message: 'En attente d\'un adversaire...' });

    // Recherche d'un adversaire (Matchmaking)
    checkAndStartDuel();
  });

  // Réception des scores / actions de duel
  socket.on('sendScore', (data) => {
    const duelId = socket.duelId;
    if (duelId && activeDuels[duelId]) {
      const duel = activeDuels[duelId];
      const opponent = duel.player1.id === socket.id ? duel.player2 : duel.player1;
      
      // Transmettre l'état à l'adversaire
      opponent.emit('opponentScore', { score: data.score, aura: data.aura });
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`Joueur déconnecté : ${socket.id}`);
    waitingPlayers = waitingPlayers.filter(p => p.id !== socket.id);
    
    if (socket.duelId && activeDuels[socket.duelId]) {
      const duel = activeDuels[socket.duelId];
      const opponent = duel.player1.id === socket.id ? duel.player2 : duel.player1;
      opponent.emit('opponentLeft');
      delete activeDuels[socket.duelId];
    }
  });
});

// Fonction pour associer 2 joueurs en duel
function checkAndStartDuel() {
  if (waitingPlayers.length >= 2) {
    const player1 = waitingPlayers.shift();
    const player2 = waitingPlayers.shift();

    const duelId = `duel_${player1.id}_${player2.id}`;
    player1.duelId = duelId;
    player2.duelId = duelId;

    activeDuels[duelId] = { player1, player2 };

    // Lancer le duel pour les deux joueurs (timer de 20s)
    player1.emit('startDuel', { opponent: player2.userData, role: 'p1' });
    player2.emit('startDuel', { opponent: player1.userData, role: 'p2' });
  }
}

// Le port est récupéré dynamiquement via process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur AuraZone démarré sur le port ${PORT}`);
});
