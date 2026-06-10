const difficulties = {
    beginner: { rows: 9, cols: 9, mines: 10 },
    intermediate: { rows: 16, cols: 16, mines: 40 },
    expert: { rows: 16, cols: 30, mines: 99 }
};

let currentDifficulty = 'beginner';
let board = [];
let revealedCount = 0;
let flagCount = 0;
let timer = 0;
let timerInterval = null;
let gameStatus = 'ready'; // ready, playing, won, lost
let firstClick = true;
let touchTimer = null;

const boardElement = document.getElementById('board');
const mineCountElement = document.getElementById('mine-count');
const timerElement = document.getElementById('timer');
const bestTimeElement = document.getElementById('best-time');
const difficultySelect = document.getElementById('difficulty');
const restartButton = document.getElementById('restart');
const messageElement = document.getElementById('message');

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function initGame() {
    const config = difficulties[currentDifficulty];
    board = [];
    revealedCount = 0;
    flagCount = 0;
    timer = 0;
    gameStatus = 'ready';
    firstClick = true;
    
    clearInterval(timerInterval);
    timerElement.textContent = '0:00';
    mineCountElement.textContent = config.mines;
    messageElement.textContent = '';
    messageElement.className = 'message';
    
    // Display best time
    const bestTime = localStorage.getItem(`bestTime_${currentDifficulty}`);
    bestTimeElement.textContent = bestTime ? formatTime(parseInt(bestTime)) : '-';

    // Remove animation classes
    document.querySelector('.game-container').classList.remove('shake');
    document.body.classList.remove('flash-red');
    
    // Clear confetti
    document.querySelectorAll('.confetti').forEach(c => c.remove());

    // Calculate dynamic cell size to fit the screen
    // Increased expert size by allowing more of the viewport
    const maxWidth = window.innerWidth * 0.95;
    const maxHeight = window.innerHeight * 0.75;
    const sizeByWidth = Math.floor(maxWidth / config.cols);
    const sizeByHeight = Math.floor(maxHeight / config.rows);
    const cellSize = Math.min(40, sizeByWidth, sizeByHeight);
    
    boardElement.style.setProperty('--cell-size', `${cellSize}px`);
    boardElement.style.gridTemplateColumns = `repeat(${config.cols}, var(--cell-size))`;
    boardElement.innerHTML = '';

    for (let r = 0; r < config.rows; r++) {
        board[r] = [];
        for (let c = 0; c < config.cols; c++) {
            const cell = {
                r, c,
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborMines: 0
            };
            board[r][c] = cell;

            const cellElement = document.createElement('div');
            cellElement.classList.add('cell');
            cellElement.dataset.r = r;
            cellElement.dataset.c = c;
            
            // Mouse Events
            cellElement.addEventListener('click', () => {
                if (cell.isRevealed) {
                    handleChording(r, c);
                } else {
                    handleCellClick(r, c);
                }
            });
            cellElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handleCellRightClick(r, c);
            });

            // Touch Events (Mobile Support)
            cellElement.addEventListener('touchstart', (e) => {
                touchTimer = setTimeout(() => {
                    handleCellRightClick(r, c);
                    touchTimer = null;
                }, 500); // 500ms for long press
            }, { passive: true });
            
            cellElement.addEventListener('touchend', (e) => {
                if (touchTimer) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                    if (!cell.isFlagged) {
                        if (cell.isRevealed) handleChording(r, c);
                        else handleCellClick(r, c);
                    }
                }
            });

            boardElement.appendChild(cellElement);
            cell.element = cellElement;
        }
    }
}

function handleChording(r, c) {
    if (gameStatus !== 'playing') return;
    const cell = board[r][c];
    if (!cell.isRevealed || cell.neighborMines === 0) return;

    const config = difficulties[currentDifficulty];
    let flagsAround = 0;
    const neighbors = [];

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols && (dr !== 0 || dc !== 0)) {
                const neighbor = board[nr][nc];
                neighbors.push(neighbor);
                if (neighbor.isFlagged) flagsAround++;
            }
        }
    }

    if (flagsAround === cell.neighborMines) {
        neighbors.forEach(n => {
            if (!n.isRevealed && !n.isFlagged) {
                if (n.isMine) {
                    n.element.classList.add('exploded');
                    gameOver(false);
                } else {
                    revealCell(n.r, n.c);
                }
            }
        });
        if (checkWin() && gameStatus !== 'lost') {
            gameOver(true);
        }
    }
}

function placeMines(excludeR, excludeC) {
    const config = difficulties[currentDifficulty];
    
    let minesPlaced = 0;
    while (minesPlaced < config.mines) {
        const r = Math.floor(Math.random() * config.rows);
        const c = Math.floor(Math.random() * config.cols);

        // Don't place mine on first click or already placed mine
        if ((r !== excludeR || c !== excludeC) && !board[r][c].isMine) {
            board[r][c].isMine = true;
            minesPlaced++;
        }
    }

    // Calculate neighbor counts
    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            if (!board[r][c].isMine) {
                board[r][c].neighborMines = countNeighborMines(r, c);
            }
        }
    }
}

function countNeighborMines(r, c) {
    const config = difficulties[currentDifficulty];
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols && board[nr][nc].isMine) {
                count++;
            }
        }
    }
    return count;
}

function handleCellClick(r, c) {
    if (gameStatus === 'won' || gameStatus === 'lost') return;
    const cell = board[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    if (firstClick) {
        firstClick = false;
        placeMines(r, c);
        startTimer();
        gameStatus = 'playing';
    }

    if (cell.isMine) {
        cell.element.classList.add('exploded');
        gameOver(false);
        return;
    }

    revealCell(r, c);

    if (checkWin()) {
        gameOver(true);
    }
}

function revealCell(r, c) {
    const cell = board[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    cell.isRevealed = true;
    cell.element.classList.add('revealed');
    revealedCount++;

    if (cell.neighborMines > 0) {
        cell.element.textContent = cell.neighborMines;
        cell.element.dataset.num = cell.neighborMines;
    } else {
        // Flood fill
        const config = difficulties[currentDifficulty];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) {
                    revealCell(nr, nc);
                }
            }
        }
    }
}

function handleCellRightClick(r, c) {
    if (gameStatus !== 'playing' && gameStatus !== 'ready') return;
    const cell = board[r][c];
    if (cell.isRevealed) return;

    cell.isFlagged = !cell.isFlagged;
    cell.element.classList.toggle('flagged');
    
    const config = difficulties[currentDifficulty];
    flagCount += cell.isFlagged ? 1 : -1;
    mineCountElement.textContent = config.mines - flagCount;
}

function startTimer() {
    timerInterval = setInterval(() => {
        timer++;
        timerElement.textContent = formatTime(timer);
    }, 1000);
}

function checkWin() {
    const config = difficulties[currentDifficulty];
    return revealedCount === (config.rows * config.cols - config.mines);
}

function gameOver(isWin) {
    gameStatus = isWin ? 'won' : 'lost';
    clearInterval(timerInterval);

    if (isWin) {
        messageElement.textContent = 'YOU WIN! 🎉✨';
        messageElement.classList.add('win', 'celebrate');
        createConfetti();

        // High score logic
        const key = `bestTime_${currentDifficulty}`;
        const prevBest = localStorage.getItem(key);
        if (!prevBest || timer < parseInt(prevBest)) {
            localStorage.setItem(key, timer);
            bestTimeElement.textContent = formatTime(timer);
        }
    } else {
        messageElement.textContent = 'GAME OVER 💣💥';
        messageElement.classList.add('lose');
        
        // Add visual feedback for explosion
        document.querySelector('.game-container').classList.add('shake');
        document.body.classList.add('flash-red');
        
        revealAllMines();
    }
}

function createConfetti() {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animation = `confetti-fall ${Math.random() * 3 + 2}s linear forwards`;
        confetti.style.opacity = Math.random();
        document.body.appendChild(confetti);
    }
}

function revealAllMines() {
    const config = difficulties[currentDifficulty];
    for (let r = 0; r < config.rows; r++) {
        for (let c = 0; c < config.cols; c++) {
            if (board[r][c].isMine) {
                board[r][c].element.classList.add('revealed', 'mine');
            }
        }
    }
}

difficultySelect.addEventListener('change', (e) => {
    currentDifficulty = e.target.value;
    initGame();
});

restartButton.addEventListener('click', initGame);

// Initial start
initGame();
