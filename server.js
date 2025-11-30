const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// 提供靜態檔案（React build 後的檔案）
app.use(express.static(path.join(__dirname, 'client/build')));

// 所有其他路由都導向 React 應用
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// 建立 HTTP 伺服器
const server = http.createServer(app);

// 建立 WebSocket 伺服器
const wss = new WebSocket.Server({ server });

class TenGame {
  constructor() {
    this.rooms = new Map();
    this.waitingPlayer = null;
  }

  createRoom(player1, player2) {
    const roomId = `room_${Date.now()}`;
    const room = {
      id: roomId,
      players: {
        X: player1,
        O: player2
      },
      smallBoards: Array(9).fill(null).map(() => Array(9).fill(null)),
      bigBoardWinners: Array(9).fill(null),
      currentPlayer: 'X',
      activeBoard: null,
      lastMove: null,
      winner: null
    };

    player1.roomId = roomId;
    player2.roomId = roomId;
    player1.symbol = 'X';
    player2.symbol = 'O';

    this.rooms.set(roomId, room);

    this.sendToPlayer(player1, {
      type: 'GAME_START',
      symbol: 'X',
      roomId: roomId
    });

    this.sendToPlayer(player2, {
      type: 'GAME_START',
      symbol: 'O',
      roomId: roomId
    });

    this.broadcastGameState(roomId);
  }

  checkWin(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    
    for (let line of lines) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  }

  isBoardFull(board) {
    return board.every(cell => cell !== null);
  }

  handleMove(ws, data) {
    const room = this.rooms.get(ws.roomId);
    if (!room) return;

    const { bigIndex, smallIndex } = data;
    
    if (ws.symbol !== room.currentPlayer) {
      this.sendToPlayer(ws, {
        type: 'ERROR',
        message: '還沒輪到你'
      });
      return;
    }

    if (room.activeBoard !== null && room.activeBoard !== bigIndex) {
      this.sendToPlayer(ws, {
        type: 'ERROR',
        message: '必須下在指定的大格'
      });
      return;
    }

    if (room.bigBoardWinners[bigIndex]) {
      this.sendToPlayer(ws, {
        type: 'ERROR',
        message: '該大格已被佔領'
      });
      return;
    }

    if (room.smallBoards[bigIndex][smallIndex]) {
      this.sendToPlayer(ws, {
        type: 'ERROR',
        message: '該位置已被佔用'
      });
      return;
    }

    room.smallBoards[bigIndex][smallIndex] = room.currentPlayer;
    room.lastMove = { bigIndex, smallIndex };

    const bigWinner = this.checkWin(room.smallBoards[bigIndex]);
    if (bigWinner) {
      room.bigBoardWinners[bigIndex] = bigWinner;

      const gameWinner = this.checkWin(room.bigBoardWinners);
      if (gameWinner) {
        room.winner = gameWinner;
        this.broadcastGameState(room.id);
        return;
      }
    } else if (this.isBoardFull(room.smallBoards[bigIndex])) {
      room.bigBoardWinners[bigIndex] = 'DRAW';
    }

    if (room.bigBoardWinners.every(w => w !== null)) {
      const gameWinner = this.checkWin(room.bigBoardWinners);
      if (!gameWinner) {
        room.winner = 'DRAW';
        this.broadcastGameState(room.id);
        return;
      }
    }

    const nextBigIndex = smallIndex;
    if (room.bigBoardWinners[nextBigIndex] || this.isBoardFull(room.smallBoards[nextBigIndex])) {
      room.activeBoard = null;
    } else {
      room.activeBoard = nextBigIndex;
    }

    room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';

    this.broadcastGameState(room.id);
  }

  broadcastGameState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const gameState = {
      type: 'GAME_STATE',
      smallBoards: room.smallBoards,
      bigBoardWinners: room.bigBoardWinners,
      currentPlayer: room.currentPlayer,
      activeBoard: room.activeBoard,
      lastMove: room.lastMove,
      winner: room.winner
    };

    Object.values(room.players).forEach(player => {
      if (player.readyState === WebSocket.OPEN) {
        this.sendToPlayer(player, gameState);
      }
    });
  }

  sendToPlayer(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  handleDisconnect(ws) {
    if (ws.roomId) {
      const room = this.rooms.get(ws.roomId);
      if (room) {
        Object.values(room.players).forEach(player => {
          if (player !== ws && player.readyState === WebSocket.OPEN) {
            this.sendToPlayer(player, {
              type: 'OPPONENT_DISCONNECT',
              message: '對手已離線'
            });
          }
        });
        this.rooms.delete(ws.roomId);
      }
    }

    if (this.waitingPlayer === ws) {
      this.waitingPlayer = null;
    }
  }
}

const game = new TenGame();

wss.on('connection', (ws) => {
  console.log('新玩家連線');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'JOIN_GAME':
          if (game.waitingPlayer === null) {
            game.waitingPlayer = ws;
            game.sendToPlayer(ws, {
              type: 'WAITING',
              message: '等待對手加入...'
            });
          } else {
            game.createRoom(game.waitingPlayer, ws);
            game.waitingPlayer = null;
          }
          break;

        case 'MOVE':
          game.handleMove(ws, data);
          break;

        default:
          console.log('未知的訊息類型:', data.type);
      }
    } catch (error) {
      console.error('處理訊息時發生錯誤:', error);
    }
  });

  ws.on('close', () => {
    console.log('玩家離線');
    game.handleDisconnect(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket 錯誤:', error);
  });
});

server.listen(PORT, () => {
  console.log(`Ten 遊戲伺服器運行在 port ${PORT}`);
});