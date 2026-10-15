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

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

let waitingQueue = [];
let registeredUsers = {};

io.on('connection', (socket) => {
  console.log(`Joueur connecté : ${socket.id}`);

  socket.on('registerUser', (data) => {
    if (data.googleId) {
      registeredUsers[data.googleId] = {
        nickname: data.nickname,
        flag: data.flag,
        winStreak: data.winStreak || 0
      };
      io.emit('updateLeaderboard', getLeaderboardData());
    }
  });

  socket.on('getLeaderboard', () => {
    socket.emit('updateLeaderboard', getLeaderboardData());
  });

  // Alignement exact avec index.html (findMatch)
  socket.on('findMatch', (data) => {
    socket.userData = {
      id: socket.id,
      nickname: data.nickname || 'Joueur',
      flag: data.flag || '🇫🇷',
      winStreak: data.winStreak || 0
    };

    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);

    if (waitingQueue.length > 0) {
      const opponent = waitingQueue.shift();
      const roomId = `room_${socket.id}_${opponent.id}`;

      socket.join(roomId);
      opponent.join(roomId);

      socket.roomId = roomId;
      opponent.roomId = roomId;

      // Envoi de matchFound aux 2 joueurs
      socket.emit('matchFound', {
        roomId: roomId,
        role: 'player1',
        opponentName: opponent.userData.nickname,
        opponentFlag: opponent.userData.flag,
        opponentStreak: opponent.userData.winStreak
      });

      opponent.emit('matchFound', {
        roomId: roomId,
        role: 'player2',
        opponentName: socket.userData.nickname,
        opponentFlag: socket.userData.flag,
        opponentStreak: socket.userData.winStreak
      });
    } else {
      waitingQueue.push(socket);
    }
  });

  socket.on('updateAura', (data) => {
    if (data.room) {
      socket.to(data.room).emit('opponentAura', { aura: data.aura });
    }
  });

  socket.on('signal', (data) => {
    if (data.room) {
      socket.to(data.room).emit('signal', { signal: data.signal });
    }
  });

  socket.on('disconnect', () => {
    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
    if (socket.roomId) {
      socket.to(socket.roomId).emit('opponentAura', { aura: 0 });
    }
  });
});

function getLeaderboardData() {
  return Object.values(registeredUsers)
    .sort((a, b) => b.winStreak - a.winStreak)
    .slice(0, 10);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur AuraZone actif sur le port ${PORT}`);
});
