import React, { useState, useEffect, useRef } from 'react';
import { X, Circle, Wifi, WifiOff } from 'lucide-react';

function App() {
  const [smallBoards, setSmallBoards] = useState(Array(9).fill(null).map(() => Array(9).fill(null)));
  const [bigBoardWinners, setBigBoardWinners] = useState(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [activeBoard, setActiveBoard] = useState(null);
  const [winner, setWinner] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [mySymbol, setMySymbol] = useState(null);
  const [gameStatus, setGameStatus] = useState('DISCONNECTED');
  const [errorMessage, setErrorMessage] = useState('');
  // 自動偵測 WebSocket 伺服器位址
  const getDefaultServerUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  };
  
  const [serverUrl, setServerUrl] = useState(getDefaultServerUrl());
  
  const wsRef = useRef(null);

  const connectWebSocket = () => {
    try {
      setGameStatus('CONNECTING');
      setErrorMessage('');
      
      const ws = new WebSocket(serverUrl);
      
      ws.onopen = () => {
        console.log('已連線到伺服器');
        wsRef.current = ws;
        ws.send(JSON.stringify({ type: 'JOIN_GAME' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerMessage(data);
        } catch (error) {
          console.error('解析訊息失敗:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket 錯誤:', error);
        setErrorMessage('連線錯誤，請確認伺服器是否運行');
        setGameStatus('DISCONNECTED');
      };

      ws.onclose = () => {
        console.log('與伺服器斷線');
        setGameStatus('DISCONNECTED');
        wsRef.current = null;
      };
    } catch (error) {
      console.error('建立連線失敗:', error);
      setErrorMessage('無法連線到伺服器');
      setGameStatus('DISCONNECTED');
    }
  };

  const handleServerMessage = (data) => {
    switch (data.type) {
      case 'WAITING':
        setGameStatus('WAITING');
        setErrorMessage('');
        break;

      case 'GAME_START':
        setMySymbol(data.symbol);
        setGameStatus('PLAYING');
        setErrorMessage('');
        break;

      case 'GAME_STATE':
        setSmallBoards(data.smallBoards);
        setBigBoardWinners(data.bigBoardWinners);
        setCurrentPlayer(data.currentPlayer);
        setActiveBoard(data.activeBoard);
        setLastMove(data.lastMove);
        setWinner(data.winner);
        setErrorMessage('');
        break;

      case 'ERROR':
        setErrorMessage(data.message);
        setTimeout(() => setErrorMessage(''), 3000);
        break;

      case 'OPPONENT_DISCONNECT':
        setErrorMessage(data.message);
        setGameStatus('DISCONNECTED');
        break;

      default:
        console.log('未知的訊息類型:', data.type);
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleCellClick = (bigIndex, smallIndex) => {
    if (gameStatus !== 'PLAYING') return;
    if (winner) return;
    if (mySymbol !== currentPlayer) return;
    if (activeBoard !== null && activeBoard !== bigIndex) return;
    if (bigBoardWinners[bigIndex]) return;
    if (smallBoards[bigIndex][smallIndex]) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'MOVE',
        bigIndex,
        smallIndex
      }));
    }
  };

  const handleDisconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setGameStatus('DISCONNECTED');
    setMySymbol(null);
    setWinner(null);
    setSmallBoards(Array(9).fill(null).map(() => Array(9).fill(null)));
    setBigBoardWinners(Array(9).fill(null));
    setCurrentPlayer('X');
    setActiveBoard(null);
    setLastMove(null);
  };

  const renderSymbol = (player, size = 'small') => {
    const sizeClass = size === 'large' ? 'w-16 h-16' : 'w-6 h-6';
    if (player === 'X') {
      return <X className={`${sizeClass} text-blue-500`} strokeWidth={3} />;
    } else if (player === 'O') {
      return <Circle className={`${sizeClass} text-red-500`} strokeWidth={3} />;
    }
    return null;
  };

  const renderSmallCell = (bigIndex, smallIndex) => {
    const player = smallBoards[bigIndex][smallIndex];
    const isLastMove = lastMove?.bigIndex === bigIndex && lastMove?.smallIndex === smallIndex;
    const isActive = (activeBoard === null || activeBoard === bigIndex) && mySymbol === currentPlayer;
    const isBoardWon = bigBoardWinners[bigIndex] !== null;
    
    return (
      <button
        key={smallIndex}
        onClick={() => handleCellClick(bigIndex, smallIndex)}
        disabled={!isActive || isBoardWon || player !== null || gameStatus !== 'PLAYING'}
        className={`
          w-10 h-10 border border-gray-400 flex items-center justify-center
          transition-all duration-200
          ${!isBoardWon && isActive && !player && gameStatus === 'PLAYING' ? 'hover:bg-gray-100 cursor-pointer' : 'cursor-not-allowed'}
          ${isLastMove ? 'bg-yellow-100' : ''}
          ${!isActive && !isBoardWon ? 'opacity-30' : ''}
        `}
      >
        {player && renderSymbol(player)}
      </button>
    );
  };

  const renderBigBoard = (bigIndex) => {
    const winner = bigBoardWinners[bigIndex];
    const isActive = (activeBoard === null || activeBoard === bigIndex) && mySymbol === currentPlayer;

    return (
      <div
        key={bigIndex}
        className={`
          relative border-4 border-gray-800 p-1
          ${isActive && !winner && gameStatus === 'PLAYING' ? 'ring-4 ring-green-400' : ''}
          ${winner ? 'bg-gray-100' : 'bg-white'}
        `}
      >
        <div className="grid grid-cols-3 gap-0">
          {Array(9).fill(null).map((_, smallIndex) => 
            renderSmallCell(bigIndex, smallIndex)
          )}
        </div>

        {winner && winner !== 'DRAW' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 pointer-events-none">
            {renderSymbol(winner, 'large')}
          </div>
        )}
        {winner === 'DRAW' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 bg-opacity-90 pointer-events-none">
            <span className="text-2xl font-bold text-gray-600">平手</span>
          </div>
        )}
      </div>
    );
  };

  const renderConnectionStatus = () => {
    const statusConfig = {
      DISCONNECTED: { text: '未連線', color: 'text-red-500', icon: <WifiOff className="w-5 h-5" /> },
      CONNECTING: { text: '連線中...', color: 'text-yellow-500', icon: <Wifi className="w-5 h-5 animate-pulse" /> },
      WAITING: { text: '等待對手...', color: 'text-blue-500', icon: <Wifi className="w-5 h-5 animate-pulse" /> },
      PLAYING: { text: '遊戲中', color: 'text-green-500', icon: <Wifi className="w-5 h-5" /> }
    };

    const status = statusConfig[gameStatus];

    return (
      <div className={`flex items-center gap-2 ${status.color}`}>
        {status.icon}
        <span className="font-semibold">{status.text}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="mb-6 text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">Ten 遊戲（線上對戰）</h1>
        <p className="text-gray-600">九宮格中的九宮格</p>
      </div>

      <div className="mb-4">
        {renderConnectionStatus()}
      </div>

      <div className="mb-6 text-center bg-white rounded-lg shadow-lg p-4 min-w-[320px]">
        {gameStatus === 'DISCONNECTED' && (
          <div>
            <div className="text-gray-700 font-semibold mb-3">準備開始遊戲</div>
            <div className="mb-3">
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="伺服器位址"
                className="px-3 py-2 border border-gray-300 rounded w-full mb-2"
              />
            </div>
            <button
              onClick={connectWebSocket}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              連線到伺服器
            </button>
            {errorMessage && (
              <div className="mt-3 text-red-500 text-sm">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {gameStatus === 'CONNECTING' && (
          <div className="text-yellow-500 font-semibold animate-pulse">
            連線中...
          </div>
        )}

        {gameStatus === 'WAITING' && (
          <div>
            <div className="text-blue-500 font-semibold animate-pulse mb-3">
              等待另一位玩家加入...
            </div>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm"
            >
              取消等待
            </button>
          </div>
        )}

        {gameStatus === 'PLAYING' && (
          <>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm text-gray-600">你是：</span>
              {renderSymbol(mySymbol)}
              <span className="text-lg font-bold text-gray-800">{mySymbol}</span>
            </div>

            {!winner ? (
              <div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-semibold">當前玩家：</span>
                  {renderSymbol(currentPlayer)}
                  <span className="text-2xl font-bold text-gray-800">{currentPlayer}</span>
                </div>
                {mySymbol === currentPlayer ? (
                  <div className="mt-2 text-green-600 font-semibold">輪到你了！</div>
                ) : (
                  <div className="mt-2 text-gray-500">等待對手...</div>
                )}
              </div>
            ) : winner === 'DRAW' ? (
              <div className="text-2xl font-bold text-gray-600">遊戲平手！</div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                {winner === mySymbol ? (
                  <span className="text-2xl font-bold text-green-600">你贏了！🎉</span>
                ) : (
                  <span className="text-2xl font-bold text-red-600">你輸了</span>
                )}
              </div>
            )}

            {activeBoard !== null && !winner && mySymbol === currentPlayer && (
              <div className="mt-2 text-sm text-gray-600">
                必須下在第 {activeBoard + 1} 格
              </div>
            )}
            {activeBoard === null && !winner && mySymbol === currentPlayer && (
              <div className="mt-2 text-sm text-green-600 font-semibold">
                可以選擇任意大格
              </div>
            )}

            <button
              onClick={handleDisconnect}
              className="mt-3 px-4 py-2 bg-red-400 text-white rounded hover:bg-red-500 text-sm"
            >
              離開遊戲
            </button>
          </>
        )}

        {errorMessage && gameStatus === 'PLAYING' && (
          <div className="mt-2 text-red-500 font-semibold text-sm">
            {errorMessage}
          </div>
        )}
      </div>

      {gameStatus === 'PLAYING' && (
        <div className="grid grid-cols-3 gap-2 mb-6 bg-gray-800 p-2 rounded-lg shadow-2xl">
          {Array(9).fill(null).map((_, i) => renderBigBoard(i))}
        </div>
      )}

      <div className="mt-6 max-w-2xl bg-white rounded-lg shadow-lg p-4 text-sm text-gray-700">
        <h3 className="font-bold mb-2">遊戲規則：</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>在小格中連成三個即可佔領該大格</li>
          <li>在大棋盤中佔領三個連線即獲勝</li>
          <li><strong>關鍵規則：</strong>你下在哪個小格位置，對手下一步就必須去對應的大格</li>
          <li>若指定的大格已被佔領或填滿，則可自由選擇任意大格</li>
          <li>綠框表示當前可下棋的大格</li>
        </ul>
      </div>
    </div>
  );
}

export default App;