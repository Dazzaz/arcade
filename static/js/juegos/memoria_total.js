document.addEventListener('DOMContentLoaded', () => {
    window.showToast = function(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = `<span style="color: #44aaff; font-size:1.2rem;">&#8505;</span>`;
        if (type === 'success') icon = `<span style="color: var(--accent); font-size:1.2rem;">&#10003;</span>`;
        if (type === 'error') icon = `<span style="color: #ff4444; font-size:1.2rem;">&#10005;</span>`;
        
        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('fadeOut');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    };

    let sequence = [];
    let playerSequence = [];
    let level = 0;
    let isGameActive = false;
    let isPlayerTurn = false;

    // Configuración global (Ajustes)
    let masterVolume = 0.5; 
    let speedMultiplier = 1.0; 
    let isStrictMode = true;
    let isMuted = false;
    let synthType = 'modern';
    let isReverseMode = false;
    let boardSize = 4;
    let autoGrowMode = false;
    let remainingLives = 0;

    // Variables de Versus
    let isVersusModeActive = false;
    let currentChallengeId = null;
    let seededRng = null;

    // Menú Elements
    const gameMenu = document.getElementById('game-menu');
    const settingsPanel = document.getElementById('settings-panel');
    const leaderboardPanel = document.getElementById('leaderboard-panel');
    const gameInterface = document.getElementById('game-interface');
    
    // Botones de navegación
    const menuStartBtn = document.getElementById('menu-start-btn');
    const settingsOpenBtn = document.getElementById('settings-open-btn');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const leaderboardOpenBtn = document.getElementById('leaderboard-open-btn');
    const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');
    const leaderboardBody = document.getElementById('leaderboard-body');
    const quitBtn = document.getElementById('quit-btn');

    // Elementos de Configuración
    const boardSizeSelect = document.getElementById('board-size-select');
    const autoGrowModeToggle = document.getElementById('auto-grow-mode');
    const volumeSlider = document.getElementById('volume-slider');
    const speedSelect = document.getElementById('speed-select');
    const synthSelect = document.getElementById('synth-select');
    const strictModeToggle = document.getElementById('strict-mode');
    const visualEffectsToggle = document.getElementById('visual-effects');
    const muteModeToggle = document.getElementById('mute-mode');
    const reverseModeToggle = document.getElementById('reverse-mode');
    const themeSelect = document.getElementById('theme-select');
    const bgEffectsDiv = document.getElementById('bg-effects');

    // Game Elements
    const ALL_COLORS = ['green', 'red', 'yellow', 'blue', 'purple', 'orange', 'cyan', 'pink', 'white'];
    let colors = [];
    let colorButtons = {};
    
    const startBtn = document.getElementById('start-btn');
    const levelDisplay = document.getElementById('level-display');
    const statusMessage = document.getElementById('status-message');
    const livesDisplayContainer = document.getElementById('lives-display');
    const livesSpan = livesDisplayContainer.querySelector('span');
    const simonBoard = document.getElementById('simon-board-container');

    let audioCtx = null;

    // --- SISTEMA DE TABLERO DINÁMICO ---
    function renderBoard(size) {
        simonBoard.innerHTML = ''; 
        
        simonBoard.classList.remove('grid-4', 'grid-6', 'grid-9');
        simonBoard.classList.add(`grid-${size}`);
        
        colors = ALL_COLORS.slice(0, size);
        colorButtons = {};

        colors.forEach(color => {
            const btn = document.createElement('div');
            btn.className = `color-btn ${color}`;
            btn.id = color;
            btn.dataset.color = color;
            simonBoard.appendChild(btn);
            colorButtons[color] = btn;

            btn.addEventListener('click', handleColorClick);
        });
    }

    // --- SISTEMA DE GUARDADO (LOCAL STORAGE) ---
    function saveSettings() {
        const settings = {
            boardSize: boardSizeSelect.value,
            autoGrowMode: autoGrowModeToggle.checked,
            volume: volumeSlider.value,
            speed: speedSelect.value,
            strictMode: strictModeToggle.checked,
            visualEffects: visualEffectsToggle.checked,
            muteMode: muteModeToggle.checked,
            theme: themeSelect.value,
            synthType: synthSelect.value,
            reverseMode: reverseModeToggle.checked
        };
        localStorage.setItem('memoriaTotalSettings', JSON.stringify(settings));
    }

    function loadSettings() {
        const saved = localStorage.getItem('memoriaTotalSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                
                if(settings.boardSize !== undefined) boardSizeSelect.value = settings.boardSize;
                if(settings.autoGrowMode !== undefined) autoGrowModeToggle.checked = settings.autoGrowMode;
                if(settings.volume !== undefined) volumeSlider.value = settings.volume;
                if(settings.speed !== undefined) speedSelect.value = settings.speed;
                if(settings.strictMode !== undefined) strictModeToggle.checked = settings.strictMode;
                if(settings.visualEffects !== undefined) visualEffectsToggle.checked = settings.visualEffects;
                if(settings.muteMode !== undefined) muteModeToggle.checked = settings.muteMode;
                if(settings.theme !== undefined) themeSelect.value = settings.theme;
                if(settings.synthType !== undefined) synthSelect.value = settings.synthType;
                if(settings.reverseMode !== undefined) reverseModeToggle.checked = settings.reverseMode;
            } catch(e) {
                console.error("Error al cargar ajustes locales:", e);
            }
        }
        
        // Aplicar estado inicial
        autoGrowMode = autoGrowModeToggle.checked;
        masterVolume = parseInt(volumeSlider.value) / 100;
        speedMultiplier = parseFloat(speedSelect.value);
        isStrictMode = strictModeToggle.checked;
        isMuted = muteModeToggle.checked;
        synthType = synthSelect.value;
        isReverseMode = reverseModeToggle.checked;

        if (autoGrowMode) {
            boardSizeSelect.disabled = true;
            boardSizeSelect.style.opacity = '0.5';
            boardSize = 4;
        } else {
            boardSizeSelect.disabled = false;
            boardSizeSelect.style.opacity = '1';
            boardSize = parseInt(boardSizeSelect.value);
        }

        if (visualEffectsToggle.checked) {
            bgEffectsDiv.style.opacity = '1';
        } else {
            bgEffectsDiv.style.opacity = '0';
        }

        if (themeSelect.value === 'circle') {
            simonBoard.classList.add('theme-circle');
        } else {
            simonBoard.classList.remove('theme-circle');
        }

        renderBoard(boardSize);
    }

    loadSettings();

    // --- AUDIO SYSTEM ---
    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    const frequencies = { 
        green: 329.63, 
        red: 261.63, 
        yellow: 293.66, 
        blue: 392.00,
        purple: 440.00, 
        orange: 493.88, 
        cyan: 523.25,   
        pink: 587.33,   
        white: 659.25   
    };

    function playTone(color, duration = 400) {
        if (!audioCtx || isMuted || masterVolume === 0) return;
        
        const now = audioCtx.currentTime;
        const durationSec = duration / 1000;
        
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        
        if (synthType === '8bit') {
            osc1.type = 'square';
            osc2.type = 'square';
        } else if (synthType === 'classic') {
            osc1.type = 'sawtooth';
            osc2.type = 'sine';
        } else {
            osc1.type = 'sine';
            osc2.type = 'triangle';
        }
        
        osc1.frequency.setValueAtTime(frequencies[color], now);
        osc2.frequency.setValueAtTime(frequencies[color], now);
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(500, now + durationSec);
        
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0, now);
        
        let peakGain = 0.4 * masterVolume;
        if (synthType === '8bit') peakGain *= 0.6; 
        
        gainNode.gain.linearRampToValueAtTime(peakGain, now + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSec + 0.3);
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc1.start(now);
        osc2.start(now);
        
        osc1.stop(now + durationSec + 0.4);
        osc2.stop(now + durationSec + 0.4);
    }

    function playErrorTone() {
        if (!audioCtx || isMuted || masterVolume === 0) return;
        
        const now = audioCtx.currentTime;
        const durationSec = 0.6;
        
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(150, now);
        osc1.frequency.exponentialRampToValueAtTime(40, now + durationSec);
        
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(145, now);
        osc2.frequency.exponentialRampToValueAtTime(38, now + durationSec);
        
        gainNode.gain.setValueAtTime(0, now);
        const peakGain = 0.3 * masterVolume;
        
        gainNode.gain.linearRampToValueAtTime(peakGain, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
        
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + durationSec + 0.1);
        osc2.stop(now + durationSec + 0.1);
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- GAME LOGIC ---
    async function flashButton(color, delay = 400) {
        const actualDelay = delay * speedMultiplier;
        const btn = colorButtons[color];
        if(!btn) return;
        btn.classList.add('active');
        playTone(color, actualDelay);
        await sleep(actualDelay);
        btn.classList.remove('active');
        await sleep(200 * speedMultiplier);
    }

    async function playSequence() {
        isPlayerTurn = false;
        simonBoard.classList.remove('game-active');
        
        for (let i = 0; i < sequence.length; i++) {
            await flashButton(sequence[i], Math.max(200, 600 - (level * 30)));
        }
        
        isPlayerTurn = true;
        simonBoard.classList.add('game-active');
        
        if (isReverseMode) {
            statusMessage.textContent = '¡Tu turno! (Ingresa al revés)';
        } else {
            statusMessage.textContent = '¡Tu turno!';
        }
    }

    // --- LÓGICA DE GENERACIÓN ALEATORIA CON SEMILLA (VERSUS) ---
    function Mulberry32(a) {
        return function() {
          var t = a += 0x6D2B79F5;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    async function nextLevel() {
        level++;
        playerSequence = [];
        levelDisplay.textContent = level;
        statusMessage.textContent = 'Observa la secuencia...';

        // Lógica de Crecimiento Automático
        if (autoGrowMode) {
            let newSize = boardSize;
            if (level < 4) newSize = 4;
            else if (level >= 4 && level < 7) newSize = 6;
            else if (level >= 7) newSize = 9;

            if (newSize !== boardSize) {
                boardSize = newSize;
                renderBoard(boardSize);
                statusMessage.textContent = `¡Tablero expandido a ${boardSize} botones!`;
                playTone('cyan', 600); // Sonido de subida de nivel / tablero
                await sleep(1500);
                statusMessage.textContent = 'Observa la secuencia...';
            }
        }
        
        let nextColor;
        let attempt = 0;
        
        do {
            let randVal;
            if (isVersusModeActive && seededRng) {
                randVal = seededRng();
            } else {
                randVal = Math.random();
            }
            nextColor = colors[Math.floor(randVal * colors.length)];
            
            let isRepeat = false;
            if (sequence.length >= 2) {
                const last1 = sequence[sequence.length - 1];
                const last2 = sequence[sequence.length - 2];
                if (nextColor === last1 && nextColor === last2) {
                    isRepeat = true;
                }
            }
            
            if (!isRepeat || attempt > 10) {
                break;
            }
            attempt++;
        } while (true);
        
        sequence.push(nextColor);
        
        await sleep(800 * speedMultiplier);
        await playSequence();
    }

    function startGame() {
        initAudio();
        sequence = [];
        playerSequence = [];
        level = 0;
        isGameActive = true;
        
        if (!isStrictMode) {
            remainingLives = 2; // 2 extra lives = 3 attempts total
            livesSpan.textContent = remainingLives + 1;
            livesDisplayContainer.classList.remove('hidden');
        } else {
            livesDisplayContainer.classList.add('hidden');
        }
        
        startBtn.disabled = true;
        
        if (!isVersusModeActive) {
            // Setup initial board size based on mode
            if (autoGrowMode) {
                boardSize = 4;
                renderBoard(boardSize);
            } else {
                if (parseInt(boardSizeSelect.value) !== boardSize) {
                    boardSize = parseInt(boardSizeSelect.value);
                    renderBoard(boardSize);
                }
            }
        }

        nextLevel();
    }
    
    function resetGame() {
        sequence = [];
        playerSequence = [];
        level = 0;
        levelDisplay.textContent = '0';
        isGameActive = false;
        isPlayerTurn = false;
        simonBoard.classList.remove('game-active');
        statusMessage.textContent = 'Presiona INICIAR para jugar';
        startBtn.disabled = false;
        startBtn.style.display = '';
        quitBtn.classList.remove('primary-btn');
        livesDisplayContainer.classList.add('hidden');
        
        isVersusModeActive = false;
        currentChallengeId = null;
        seededRng = null;
    }

    async function gameOver() {
        playErrorTone();
        isGameActive = false;
        isPlayerTurn = false;
        simonBoard.classList.remove('game-active');
        
        document.body.style.backgroundColor = '#300a0a';
        setTimeout(() => {
            document.body.style.backgroundColor = '';
        }, 500);

        if (!isStrictMode && remainingLives > 0) {
            remainingLives--;
            livesSpan.textContent = remainingLives + 1;
            statusMessage.textContent = `¡Cuidado! Te quedan ${remainingLives + 1} intentos`;
            await sleep(1500);
            
            playerSequence = [];
            isGameActive = true;
            statusMessage.textContent = 'Repitiendo secuencia...';
            await sleep(500);
            await playSequence();
        } else {
            if (isVersusModeActive) {
                statusMessage.textContent = `¡Versus Terminado! Nivel ${level}`;
                startBtn.style.display = 'none';
                quitBtn.classList.add('primary-btn');
                
                fetch('/api/complete_challenge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        challenge_id: currentChallengeId,
                        score: level
                    })
                }).then(() => {
                    showToast('¡Puntuación de duelo enviada!', 'success');
                    pollChallenges(true); // Sincronizar punto rojo
                }).catch(e => console.error(e));
                
            } else {
                statusMessage.textContent = `¡Juego Terminado! Llegaste al Nivel ${level}`;
                startBtn.disabled = false;
                
                // Guardado automático del Score
                fetch('/api/save_score', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        game: 'memoria_total',
                        level: level,
                        details: { boardSize: boardSize, speed: speedMultiplier, reverse: isReverseMode }
                    })
                }).catch(e => console.error("No se pudo guardar la puntuación:", e));
            }
        }
    }

    async function handleColorClick(e) {
        if (!isGameActive || !isPlayerTurn) return;
        
        const color = e.target.dataset.color;
        playerSequence.push(color);
        
        playTone(color, 200);
        e.target.classList.add('active');
        setTimeout(() => e.target.classList.remove('active'), 200);

        const currentIndex = playerSequence.length - 1;
        let expectedColor;

        if (isReverseMode) {
            expectedColor = sequence[sequence.length - 1 - currentIndex];
        } else {
            expectedColor = sequence[currentIndex];
        }
        
        if (playerSequence[currentIndex] !== expectedColor) {
            gameOver();
            return;
        }
        
        if (playerSequence.length === sequence.length) {
            isPlayerTurn = false;
            simonBoard.classList.remove('game-active');
            statusMessage.textContent = '¡Excelente!';
            await sleep(500 * speedMultiplier);
            nextLevel();
        }
    }

    // --- EVENTOS DE MENÚ ---
    menuStartBtn.addEventListener('click', () => {
        gameMenu.classList.add('hidden');
        gameInterface.classList.remove('hidden');
        setTimeout(startGame, 600);
    });

    settingsOpenBtn.addEventListener('click', () => {
        gameMenu.classList.add('hidden');
        settingsPanel.classList.remove('hidden');
        initAudio();
    });

    settingsCloseBtn.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
        gameMenu.classList.remove('hidden');
    });

    leaderboardOpenBtn.addEventListener('click', async () => {
        gameMenu.classList.add('hidden');
        leaderboardPanel.classList.remove('hidden');
        leaderboardBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Descargando archivos clasificados...</td></tr>';
        
        try {
            const res = await fetch('/api/leaderboard?game=memoria_total');
            const data = await res.json();
            
            leaderboardBody.innerHTML = '';
            if (data.length === 0) {
                leaderboardBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Sin registros. ¡Sé el primero en marcar historia!</td></tr>';
                return;
            }
            
            data.forEach((score, index) => {
                const tr = document.createElement('tr');
                if (index === 0) tr.className = 'rank-1';
                else if (index === 1) tr.className = 'rank-2';
                else if (index === 2) tr.className = 'rank-3';
                
                tr.innerHTML = `
                    <td>#${index + 1}</td>
                    <td>${score.username} <span style="font-size: 0.6em; opacity: 0.4;">#${score.user_id.substring(0,4)}</span></td>
                    <td>NIVEL <strong>${score.level}</strong></td>
                `;
                leaderboardBody.appendChild(tr);
            });
        } catch (e) {
            leaderboardBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#ff3333;">Fallo en enlace con servidor local.</td></tr>';
        }
    });

    leaderboardCloseBtn.addEventListener('click', () => {
        leaderboardPanel.classList.add('hidden');
        gameMenu.classList.remove('hidden');
    });

    quitBtn.addEventListener('click', () => {
        if (isVersusModeActive) {
            showToast('Duelo pausado. Juega tu turno desde el menú.', 'info');
        }
        resetGame();
        gameInterface.classList.add('hidden');
        gameMenu.classList.remove('hidden');
        pollChallenges(true);
    });

    // --- EVENTOS DE AJUSTES ---
    boardSizeSelect.addEventListener('change', (e) => {
        if(!autoGrowMode) {
            boardSize = parseInt(e.target.value);
            renderBoard(boardSize);
            saveSettings();
        }
    });

    autoGrowModeToggle.addEventListener('change', (e) => {
        autoGrowMode = e.target.checked;
        if (autoGrowMode) {
            boardSizeSelect.disabled = true;
            boardSizeSelect.style.opacity = '0.5';
            boardSize = 4;
            renderBoard(boardSize);
        } else {
            boardSizeSelect.disabled = false;
            boardSizeSelect.style.opacity = '1';
            boardSize = parseInt(boardSizeSelect.value);
            renderBoard(boardSize);
        }
        saveSettings();
    });

    volumeSlider.addEventListener('input', (e) => {
        masterVolume = parseInt(e.target.value) / 100;
        initAudio();
        if(!isMuted && masterVolume > 0) {
            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            osc.frequency.value = 400;
            
            if (synthType === '8bit') osc.type = 'square';
            else if (synthType === 'classic') osc.type = 'sawtooth';
            else osc.type = 'sine';

            gainNode.gain.setValueAtTime(0.1 * masterVolume, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);
        }
        saveSettings();
    });

    speedSelect.addEventListener('change', (e) => {
        speedMultiplier = parseFloat(e.target.value);
        saveSettings();
    });

    synthSelect.addEventListener('change', (e) => {
        synthType = e.target.value;
        saveSettings();
        playTone('blue', 300);
    });

    strictModeToggle.addEventListener('change', (e) => {
        isStrictMode = e.target.checked;
        saveSettings();
    });

    muteModeToggle.addEventListener('change', (e) => {
        isMuted = e.target.checked;
        saveSettings();
    });

    reverseModeToggle.addEventListener('change', (e) => {
        isReverseMode = e.target.checked;
        saveSettings();
    });

    visualEffectsToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            bgEffectsDiv.style.opacity = '1';
        } else {
            bgEffectsDiv.style.opacity = '0';
        }
        saveSettings();
    });

    themeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'circle') {
            simonBoard.classList.add('theme-circle');
        } else {
            simonBoard.classList.remove('theme-circle');
        }
        saveSettings();
    });

    startBtn.addEventListener('click', () => {
        if (isGameActive) {
            resetGame();
            setTimeout(startGame, 500);
        } else {
            startGame();
        }
    });

    // --- LÓGICA DE INTERFAZ VERSUS ---
    const versusOpenBtn = document.getElementById('versus-open-btn');
    const versusCloseBtn = document.getElementById('versus-close-btn');
    const versusPanel = document.getElementById('versus-panel');
    const versusFriendsList = document.getElementById('versus-friends-list');
    const versusChallengesList = document.getElementById('versus-challenges-list');
    const versusBadge = document.getElementById('versus-badge');

    let knownChallengesState = {};

    async function pollChallenges(silent = false) {
        if (isGameActive) return; // No molestar si está jugando
        
        try {
            // Anti-cache header and query param to absolutely force fresh data
            const res = await fetch('/api/challenges?_t=' + new Date().getTime(), { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }});
            const data = await res.json();
            
            let hasActionable = false;
            
            data.forEach(c => {
                if (c.my_turn) hasActionable = true;
                
                const prevState = knownChallengesState[c.id];
                if (!silent && c.my_turn && (!prevState || !prevState.my_turn)) {
                    if (!prevState) {
                        showToast(`¡Nuevo reto de ${c.opponent_name}!`, 'info');
                    } else {
                        showToast(`¡Tu turno contra ${c.opponent_name}!`, 'success');
                    }
                }
                knownChallengesState[c.id] = { my_turn: c.my_turn, status: c.status };
            });
            
            if (hasActionable) {
                versusBadge.style.display = 'block';
            } else {
                versusBadge.style.display = 'none';
            }
            
            if (!versusPanel.classList.contains('hidden')) {
                renderChallengesList(data);
            }
        } catch(e) {}
    }

    setInterval(pollChallenges, 10000);
    pollChallenges();

    versusOpenBtn.addEventListener('click', () => {
        gameMenu.classList.add('hidden');
        versusPanel.classList.remove('hidden');
        loadVersusFriends();
        pollChallenges(true);
    });

    versusCloseBtn.addEventListener('click', () => {
        versusPanel.classList.add('hidden');
        gameMenu.classList.remove('hidden');
    });

    async function loadVersusFriends() {
        versusFriendsList.innerHTML = 'Cargando...';
        try {
            const res = await fetch('/api/friends?_t=' + new Date().getTime());
            const data = await res.json();
            if (data.length === 0) {
                versusFriendsList.innerHTML = '<div style="color: var(--text-secondary); text-align: center; margin-top: 2rem;">No tienes conexiones aún.</div>';
            } else {
                versusFriendsList.innerHTML = '';
                data.forEach(f => {
                    versusFriendsList.innerHTML += `
                        <div class="versus-item">
                            <div class="versus-item-info">
                                <span class="versus-item-name">${f.username}</span>
                            </div>
                            <button onclick="window.openChallengeConfig('${f.user_id}', '${f.username}')" class="versus-action-btn play-btn">RETAR</button>
                        </div>
                    `;
                });
            }
        } catch(e) {
            versusFriendsList.innerHTML = '<span style="color:#ff4444;">Error al cargar.</span>';
        }
    }

    let pendingChallengeTargetId = null;
    const challengeConfigPanel = document.getElementById('challenge-config-panel');
    const vsTargetName = document.getElementById('challenge-target-name');
    const vsSpeed = document.getElementById('vs-speed-select');
    const vsBoardSize = document.getElementById('vs-board-size');
    const vsReverseMode = document.getElementById('vs-reverse-mode');
    const vsCancelBtn = document.getElementById('vs-cancel-btn');
    const vsSendBtn = document.getElementById('vs-send-btn');

    window.openChallengeConfig = function(targetId, targetName) {
        pendingChallengeTargetId = targetId;
        vsTargetName.textContent = `Contra ${targetName}`;
        versusPanel.classList.add('hidden');
        challengeConfigPanel.classList.remove('hidden');
    }

    vsCancelBtn.addEventListener('click', () => {
        challengeConfigPanel.classList.add('hidden');
        versusPanel.classList.remove('hidden');
        pendingChallengeTargetId = null;
    });

    vsSendBtn.addEventListener('click', async () => {
        if (!pendingChallengeTargetId) return;
        
        const settings = {
            boardSize: parseInt(vsBoardSize.value),
            speed: parseFloat(vsSpeed.value),
            reverse: vsReverseMode.checked
        };
        
        vsSendBtn.disabled = true;
        vsSendBtn.textContent = 'Enviando...';

        try {
            const res = await fetch('/api/create_challenge', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    target_id: pendingChallengeTargetId,
                    settings: settings
                })
            });
            const data = await res.json();
            if(data.status === 'success') {
                showToast('¡Reto enviado! Juega tu turno ahora.', 'success');
                challengeConfigPanel.classList.add('hidden');
                
                // Iniciar la partida inmediatamente
                const cStr = encodeURIComponent(JSON.stringify(data.challenge));
                window.startChallenge(cStr);
                
                pollChallenges(true); // Sincronizar en segundo plano
            } else if (data.msg) {
                showToast(data.msg, 'error');
            } else {
                showToast('No se pudo enviar el reto.', 'error');
            }
        } catch(e) { 
            showToast('Error de red al crear reto', 'error'); 
        } finally {
            vsSendBtn.disabled = false;
            vsSendBtn.textContent = 'ENVIAR RETO';
        }
    });

    window.startChallenge = function(challengeJson) {
        const challenge = JSON.parse(decodeURIComponent(challengeJson));
        
        // Ajustes forzados por el reto
        boardSize = challenge.settings.boardSize || 4;
        speedMultiplier = challenge.settings.speed || 1.0;
        isReverseMode = challenge.settings.reverse || false;
        autoGrowMode = false; // Desactivado en versus por equidad
        
        isVersusModeActive = true;
        currentChallengeId = challenge.id;
        seededRng = Mulberry32(challenge.seed);
        
        renderBoard(boardSize);
        
        versusPanel.classList.add('hidden');
        gameInterface.classList.remove('hidden');
        
        setTimeout(startGame, 600);
    }
    
    function renderChallengesList(data) {
        let html = '';
        data.forEach(c => {
            const cStr = encodeURIComponent(JSON.stringify(c));
            let statusText = '';
            let actionBtn = '';
            let st = c.status;
            
            if (st === 'pending_both') {
                statusText = '<span class="status-badge waiting">Esperando jugadas</span>';
                if (c.my_turn) {
                    actionBtn = `<button onclick="window.startChallenge('${cStr}')" class="versus-action-btn play-btn">JUGAR</button>`;
                }
            } else if (st === 'pending_target') {
                statusText = c.am_i_creator ? '<span class="status-badge waiting">Esperando al rival</span>' : '<span class="status-badge turn">¡Tu turno!</span>';
                if (c.my_turn) {
                    actionBtn = `<button onclick="window.startChallenge('${cStr}')" class="versus-action-btn">JUGAR</button>`;
                }
            } else if (st === 'pending_creator') {
                statusText = c.am_i_creator ? '<span class="status-badge turn">¡Tu turno!</span>' : '<span class="status-badge waiting">Esperando al creador</span>';
                if (c.my_turn) {
                    actionBtn = `<button onclick="window.startChallenge('${cStr}')" class="versus-action-btn">JUGAR</button>`;
                }
            } else if (st === 'completed') {
                let myScore = c.am_i_creator ? c.creator_score : c.target_score;
                let opScore = c.am_i_creator ? c.target_score : c.creator_score;
                if (myScore > opScore) statusText = `<span class="status-badge win">¡Ganaste! (${myScore} - ${opScore})</span>`;
                else if (myScore < opScore) statusText = `<span class="status-badge loss">Perdiste (${myScore} - ${opScore})</span>`;
                else statusText = `<span class="status-badge draw">Empate (${myScore} - ${opScore})</span>`;
            }
            
            html += `
                <div class="versus-item">
                    <div class="versus-item-info">
                        <span class="versus-item-name">⚔️ ${c.opponent_name}</span>
                        <span>${statusText}</span>
                    </div>
                    ${actionBtn}
                </div>
            `;
        });
        
        versusChallengesList.innerHTML = html || '<div style="color: var(--text-secondary); text-align: center; margin-top: 2rem;">No tienes duelos activos.</div>';
    }
});
