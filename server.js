const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Base de données en mémoire pour le classement mondial
let leaderboard = [];
let waitingPlayer = null;

io.on('connection', (socket) => {
  socket.on('registerUser', (userData) => {
    if (!userData.googleId) return;
    
    let user = leaderboard.find(u => u.googleId === userData.googleId);
    if (user) {
      user.nickname = userData.nickname;
      user.flag = userData.flag;
      if (userData.winStreak > user.winStreak) user.winStreak = userData.winStreak;
    } else {
      leaderboard.push({
        googleId: userData.googleId,
        nickname: userData.nickname,
        flag: userData.flag || '🇫🇷',
        winStreak: userData.winStreak || 0
      });
    }
    leaderboard.sort((a, b) => b.winStreak - a.winStreak);
    io.emit('updateLeaderboard', leaderboard);
  });

  socket.on('getLeaderboard', () => {
    socket.emit('updateLeaderboard', leaderboard);
  });

  socket.on('findMatch', (data) => {
    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      const roomId = `room_${waitingPlayer.id}_${socket.id}`;
      socket.join(roomId);
      waitingPlayer.join(roomId);

      waitingPlayer.emit('matchFound', { 
        roomId, 
        role: 'player1', 
        opponentName: data ? data.nickname : 'Adversaire',
        opponentFlag: data ? data.flag : '🇫🇷',
        opponentStreak: data ? data.winStreak : 0
      });
      
      socket.emit('matchFound', { 
        roomId, 
        role: 'player2', 
        opponentName: waitingPlayer.nickname || 'Adversaire',
        opponentFlag: waitingPlayer.flag || '🇫🇷',
        opponentStreak: waitingPlayer.winStreak || 0
      });

      waitingPlayer = null;
    } else {
      socket.nickname = data ? data.nickname : 'Adversaire';
      socket.flag = data ? data.flag : '🇫🇷';
      socket.winStreak = data ? data.winStreak : 0;
      waitingPlayer = socket;
    }
  });

  socket.on('updateAura', (data) => {
    socket.to(data.room).emit('opponentAura', data);
  });

  socket.on('signal', (data) => {
    socket.to(data.room).emit('signal', data);
  });

  socket.on('disconnect', () => {
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur prêt sur le port ${PORT}`);
});
