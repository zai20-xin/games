// 游戏变量
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let snake = [];
let food = {};
let direction = 'right';
let animationId;
let score = 0;

// ============ 统一存储：<id>:save 存档 / <id>:settings 设置（自动迁移旧键）============
const SAVE_KEY = 'snake:save';
const SETTINGS_KEY = 'snake:settings';

function loadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

const DEFAULT_SKINS = [
    { id: 0, color: '#4CAF50', name: '默认皮肤', price: 0, currency: 'coins', owned: true },
    { id: 1, color: '#2196F3', name: '蓝色皮肤', price: 100, currency: 'coins', owned: false },
    { id: 2, color: '#FF9800', name: '橙色皮肤', price: 100, currency: 'coins', owned: false },
    { id: 3, color: '#9C27B0', name: '紫色皮肤', price: 100, currency: 'coins', owned: false },
    { id: 4, color: '#F44336', name: '红色皮肤', price: 100, currency: 'coins', owned: false },
    { id: 5, color: 'gradient', name: '蜘蛛侠', price: 6000, currency: 'diamonds', owned: false },
    { id: 6, color: 'gradient', name: '钢铁侠', price: 6000, currency: 'diamonds', owned: false },
    { id: 7, color: 'rainbow', name: '彩虹皮肤', price: 200, currency: 'coins', owned: false },
    { id: 8, color: 'neon', name: '霓虹皮肤', price: 300, currency: 'coins', owned: false },
    { id: 9, color: 'forest', name: '森林皮肤', price: 250, currency: 'coins', owned: false },
    { id: 10, color: 'ocean', name: '海洋皮肤', price: 250, currency: 'coins', owned: false },
    { id: 11, color: 'fire', name: '火焰皮肤', price: 300, currency: 'coins', owned: false }
];

// 旧版散装键 → snake:save 一次性迁移
(function migrateLegacySave() {
    if (localStorage.getItem(SAVE_KEY)) return;
    const legacySkinStates = loadJSON('snakeSkinStates', []);
    const skinsOwned = DEFAULT_SKINS.map((skin) => {
        const s = Array.isArray(legacySkinStates) ? legacySkinStates.find(x => x && x.id === skin.id) : null;
        return skin.owned || Boolean(s && s.owned);
    });
    localStorage.setItem(SAVE_KEY, JSON.stringify({
        highScore: parseInt(localStorage.getItem('snakeHighScore'), 10) || 0,
        coins: parseInt(localStorage.getItem('snakeCoins'), 10) || 150,
        diamonds: parseInt(localStorage.getItem('snakeDiamonds'), 10) || 10000,
        currentSkin: parseInt(localStorage.getItem('snakeCurrentSkin'), 10) || 0,
        skinsOwned,
        leaderboard: loadJSON('snakeLeaderboard', []),
        achievements: loadJSON('snakeAchievements', null),
        stats: loadJSON('snakeStats', null),
        playerName: localStorage.getItem('snakePlayerName') || '玩家'
    }));
})();

const saveData = loadJSON(SAVE_KEY, {});

function persistSave() {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
        highScore, coins, diamonds, currentSkin,
        skinsOwned: skins.map(s => s.owned),
        leaderboard, achievements, stats, playerName
    }));
}

const DEFAULT_ACHIEVEMENTS = [
    { id: 1, name: '初次尝试', description: '完成第一次游戏', completed: false },
    { id: 2, name: '得分新手', description: '获得100分', completed: false },
    { id: 3, name: '得分达人', description: '获得500分', completed: false },
    { id: 4, name: '得分大师', description: '获得1000分', completed: false },
    { id: 5, name: '皮肤收藏家', description: '购买5个皮肤', completed: false },
    { id: 6, name: '技能大师', description: '使用技能10次', completed: false },
    { id: 7, name: '贪吃蛇', description: '蛇的长度达到20', completed: false },
    { id: 8, name: '钻石收藏家', description: '收集100个钻石', completed: false }
];
const DEFAULT_STATS = {
    gamesPlayed: 0,
    totalScore: 0,
    skinsPurchased: 0,
    skillsUsed: 0,
    maxLength: 0,
    totalDiamonds: 0
};

let settings = Object.assign(
    { difficulty: 'easy', mode: 'classic', wrapMode: false, muted: false },
    loadJSON(SETTINGS_KEY, {})
);
function persistSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

let coins = typeof saveData.coins === 'number' ? saveData.coins : 150;
let diamonds = typeof saveData.diamonds === 'number' ? saveData.diamonds : 10000;
let baseSpeed = 200; // 由难度决定，实际间隔见 currentInterval()

// 各档基础速度与"长度提速"下限（ms/格）
const DIFFICULTY = {
    easy: { base: 200, min: 110 },
    medium: { base: 150, min: 85 },
    hard: { base: 100, min: 62 },
    extreme: { base: 60, min: 45 }
};

let lastTime = 0;
let isPaused = false;
let difficulty = DIFFICULTY[settings.difficulty] ? settings.difficulty : 'easy';
let gameMode = ['classic', 'battle'].includes(settings.mode) ? settings.mode : 'classic';
let wrapMode = Boolean(settings.wrapMode);
let timeLeft = 180; // 乱斗模式时间（秒）- 3 分钟
let timeInterval;
let highScore = typeof saveData.highScore === 'number' ? saveData.highScore : 0;
let clones = []; // 克隆体数组
let aiSnakes = []; // AI 蛇数组
let foods = []; // 多个食物数组（乱斗模式）

// 技能系统
let skills = {
    speed: { active: false, cooldown: 0, maxCooldown: 10 },
    wall: { active: false, cooldown: 0, maxCooldown: 15 },
    clone: { active: false, cooldown: 0, maxCooldown: 20 }
};

// AI 玩家名字池
const aiNames = ['暗影猎手', '闪电侠', '火焰王者', '冰霜巨人', '雷霆战神', '神秘刺客', '黄金骑士', '紫罗兰刺客', '翡翠守护者', ' crimson 死神'];

// AI 玩家类
class AISnake {
    constructor(id, name, color, startX, startY) {
        this.id = id;
        this.name = name || aiNames[Math.floor(Math.random() * aiNames.length)];
        this.color = color;
        this.snake = [
            { x: startX, y: startY },
            { x: startX - 10, y: startY },
            { x: startX - 20, y: startY }
        ];
        this.direction = 'right';
        this.score = 0;
        this.isAlive = true;
    }
    
    // AI 决策逻辑
    decideDirection() {
        if (!this.isAlive) return;
        
        const head = this.snake[0];
        
        // 1. 首先检查当前方向是否安全
        const safeDirections = this.getSafeDirections();
        
        // 如果当前方向不安全，立即改变方向
        if (!safeDirections.includes(this.direction)) {
            // 选择一个安全的方向
            if (safeDirections.length > 0) {
                this.direction = safeDirections[Math.floor(Math.random() * safeDirections.length)];
            }
            return;
        }
        
        // 2. 寻找最近的食物
        let target = null;
        let minDistance = Infinity;
        
        const allFoods = gameMode === 'battle' ? foods : [food];
        for (let f of allFoods) {
            const distance = Math.abs(head.x - f.x) + Math.abs(head.y - f.y);
            if (distance < minDistance) {
                minDistance = distance;
                target = f;
            }
        }
        
        // 3. 如果有食物，尝试朝食物移动，但要确保安全
        if (target) {
            const dx = target.x - head.x;
            const dy = target.y - head.y;
            
            // 确定优先方向
            let preferredDirs = [];
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) preferredDirs = ['right', 'down', 'up', 'left'];
                else preferredDirs = ['left', 'down', 'up', 'right'];
            } else {
                if (dy > 0) preferredDirs = ['down', 'right', 'left', 'up'];
                else preferredDirs = ['up', 'right', 'left', 'down'];
            }
            
            // 选择第一个安全的方向
            for (let dir of preferredDirs) {
                if (safeDirections.includes(dir)) {
                    this.direction = dir;
                    return;
                }
            }
        }
        
        // 4. 如果没有明确目标，继续当前安全方向或随机选择安全方向
        if (safeDirections.includes(this.direction)) {
            // 保持当前方向
            return;
        } else if (safeDirections.length > 0) {
            this.direction = safeDirections[Math.floor(Math.random() * safeDirections.length)];
        }
    }
    
    // 获取所有安全的移动方向
    getSafeDirections() {
        const head = this.snake[0];
        const safeDirs = [];
        
        // 检查四个方向是否安全
        const directions = {
            'up': { x: 0, y: -10 },
            'down': { x: 0, y: 10 },
            'left': { x: -10, y: 0 },
            'right': { x: 10, y: 0 }
        };
        
        const opposite = { 'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left' };
        
        for (let [dir, move] of Object.entries(directions)) {
            // 不能立即掉头
            if (dir === opposite[this.direction]) continue;
            
            const newX = head.x + move.x;
            const newY = head.y + move.y;
            
            // 检查边界
            if (newX < 0 || newX >= canvas.width || newY < 0 || newY >= canvas.height) {
                continue;
            }
            
            // 检查是否撞到自身
            let hitSelf = false;
            for (let i = 0; i < this.snake.length - 1; i++) { // 不检查尾巴，因为尾巴会移动
                if (newX === this.snake[i].x && newY === this.snake[i].y) {
                    hitSelf = true;
                    break;
                }
            }
            if (hitSelf) continue;
            
            // 检查是否撞到玩家蛇
            let hitPlayer = false;
            for (let segment of snake) {
                if (newX === segment.x && newY === segment.y) {
                    hitPlayer = true;
                    break;
                }
            }
            if (hitPlayer) continue;
            
            // 检查是否撞到 AI 蛇
            let hitAI = false;
            for (let ai of aiSnakes) {
                if (!ai.isAlive) continue;
                for (let segment of ai.snake) {
                    if (newX === segment.x && newY === segment.y) {
                        hitAI = true;
                        break;
                    }
                }
                if (hitAI) break;
            }
            if (hitAI) continue;
            
            safeDirs.push(dir);
        }
        
        return safeDirs;
    }
    
    // 移动 AI 蛇
    move() {
        if (!this.isAlive) return;
        
        let head = { x: this.snake[0].x, y: this.snake[0].y };
        
        switch (this.direction) {
            case 'up': head.y -= 10; break;
            case 'down': head.y += 10; break;
            case 'left': head.x -= 10; break;
            case 'right': head.x += 10; break;
        }
        
        // 检查边界碰撞
        if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
            this.isAlive = false;
            return;
        }
        
        // 检查自身碰撞
        for (let i = 1; i < this.snake.length; i++) {
            if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
                this.isAlive = false;
                return;
            }
        }
        
        // 检查是否吃到食物
        const allFoods = gameMode === 'battle' ? foods : [food];
        let ate = false;
        for (let i = 0; i < allFoods.length; i++) {
            if (head.x === allFoods[i].x && head.y === allFoods[i].y) {
                this.score += 10;
                if (gameMode === 'battle') {
                    foods.splice(i, 1);
                    generateFood(); // 生成新食物
                }
                ate = true;
                break;
            }
        }
        
        if (!ate) {
            this.snake.pop();
        }
        
        this.snake.unshift(head);
    }
}

// 粒子系统
let particles = [];

// 音效系统
const bgMusic = document.getElementById('bgMusic');
const eatSound = document.getElementById('eatSound');
const gameOverSound = document.getElementById('gameOverSound');
const skillSound = document.getElementById('skillSound');
const buySound = document.getElementById('buySound');

// 控制音效音量
bgMusic.volume = 0.3;
eatSound.volume = 0.5;
gameOverSound.volume = 0.5;
skillSound.volume = 0.5;
buySound.volume = 0.5;

// 排行榜系统
let leaderboard = Array.isArray(saveData.leaderboard) ? saveData.leaderboard : [];
let playerName = typeof saveData.playerName === 'string' ? saveData.playerName : '玩家';

// 成就系统
let achievements = Array.isArray(saveData.achievements) && saveData.achievements.length === DEFAULT_ACHIEVEMENTS.length
    ? saveData.achievements
    : DEFAULT_ACHIEVEMENTS.map(a => ({ ...a }));
let stats = Object.assign({}, DEFAULT_STATS, saveData.stats);

// 积分商城系统
let 商城物品 = [
    { id: 1, name: '金币包', description: '获得100个金币', price: 50, currency: 'diamonds', type: 'coins', value: 100 },
    { id: 2, name: '钻石包', description: '获得50个钻石', price: 200, currency: 'coins', type: 'diamonds', value: 50 },
    { id: 3, name: '超级金币包', description: '获得500个金币', price: 200, currency: 'diamonds', type: 'coins', value: 500 },
    { id: 4, name: '超级钻石包', description: '获得200个钻石', price: 800, currency: 'coins', type: 'diamonds', value: 200 },
    { id: 5, name: '技能冷却减少', description: '技能冷却时间减少20%', price: 1000, currency: 'diamonds', type: 'skill_cooldown', value: 0.8 },
    { id: 6, name: '食物吸引力', description: '食物生成几率增加', price: 800, currency: 'diamonds', type: 'food_attraction', value: 1.5 },
    { id: 7, name: '金币加成', description: '金币获得量增加50%', price: 1200, currency: 'diamonds', type: 'coin_bonus', value: 1.5 },
    { id: 8, name: '钻石加成', description: '钻石获得几率增加', price: 1500, currency: 'diamonds', type: 'diamond_bonus', value: 1.5 }
];

// 皮肤系统
let skins = [];
let currentSkin = typeof saveData.currentSkin === 'number' ? saveData.currentSkin : 0;

// 初始化皮肤系统
function initSkins() {
    const owned = Array.isArray(saveData.skinsOwned) && saveData.skinsOwned.length === DEFAULT_SKINS.length
        ? saveData.skinsOwned
        : DEFAULT_SKINS.map(s => s.owned);
    skins = DEFAULT_SKINS.map((skin, i) => ({ ...skin, owned: skin.owned || Boolean(owned[i]) }));
    if (!(currentSkin >= 0 && currentSkin < skins.length)) currentSkin = 0;
}

// 初始化游戏
function initGame() {
    // 初始化皮肤系统
    initSkins();
    
    // 初始化蛇
    const centerX = Math.floor(canvas.width / 20) * 10;
    const centerY = Math.floor(canvas.height / 20) * 10;
    snake = [
        { x: centerX, y: centerY },
        { x: centerX - 10, y: centerY },
        { x: centerX - 20, y: centerY }
    ];
    
    // 乱斗模式初始化 AI 玩家和多个食物
    if (gameMode === 'battle') {
        initBattleMode();
    } else {
        // 常规模式
        generateFood();
        aiSnakes = [];
        foods = [];
    }
    
    // 重置游戏状态
    score = 0;
    direction = 'right';
    timeLeft = gameMode === 'battle' ? 180 : 0; // 乱斗模式 3 分钟，常规模式不限时（显示为 0 或无）
    updateGameInfo();
    
    // 隐藏游戏结束界面
    document.getElementById('gameOver').style.display = 'none';
}

// 初始化乱斗模式
function initBattleMode() {
    // 生成多个食物
    foods = [];
    for (let i = 0; i < 20; i++) {
        generateFood();
    }
    
    // 创建 4 个 AI 玩家（随机名字）
    aiSnakes = [
        new AISnake(1, null, '#FF5252', 50, 50),
        new AISnake(2, null, '#4CAF50', 550, 50),
        new AISnake(3, null, '#2196F3', 50, 350),
        new AISnake(4, null, '#FFC107', 550, 350)
    ];
}

// 生成食物
function generateFood() {
    const newFood = {
        x: Math.floor(Math.random() * (canvas.width / 10)) * 10,
        y: Math.floor(Math.random() * (canvas.height / 10)) * 10
    };

    // 确保食物不生成在蛇身上
    for (let segment of snake) {
        if (segment.x === newFood.x && segment.y === newFood.y) {
            return generateFood();
        }
    }

    // 确保食物不生成在 AI 蛇身上
    for (let ai of aiSnakes) {
        for (let segment of ai.snake) {
            if (segment.x === newFood.x && segment.y === newFood.y) {
                return generateFood();
            }
        }
    }

    // 确保食物不重复
    const allFoods = gameMode === 'battle' ? foods : [food];
    for (let f of allFoods) {
        if (f && f.x === newFood.x && f.y === newFood.y) {
            return generateFood();
        }
    }

    if (gameMode === 'battle') {
        foods.push(newFood);
    } else {
        food = newFood;
    }
}

// 创建粒子
function createParticles(x, y, count, color) {
    // 限制粒子数量
    if (particles.length > 100) return;
    
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x + 5, // 中心位置
            y: y + 5,
            size: Math.random() * 4 + 2,
            speedX: (Math.random() - 0.5) * 4,
            speedY: (Math.random() - 0.5) * 4,
            color: color || '#FF6B6B',
            life: 1.0,
            decay: 0.03
        });
    }
}

// 更新粒子
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.life -= p.decay;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// 绘制粒子
function drawParticles() {
    for (let p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// 更新克隆体
function updateClones() {
    clones.forEach(clone => {
        // 移动克隆体
        let head = { x: clone.snake[0].x, y: clone.snake[0].y };
        
        switch (clone.direction) {
            case 'up':
                head.y -= 10;
                break;
            case 'down':
                head.y += 10;
                break;
            case 'left':
                head.x -= 10;
                break;
            case 'right':
                head.x += 10;
                break;
        }
        
        // 克隆体穿墙
        if (head.x < 0) head.x = canvas.width - 10;
        if (head.x >= canvas.width) head.x = 0;
        if (head.y < 0) head.y = canvas.height - 10;
        if (head.y >= canvas.height) head.y = 0;
        
        // 移除克隆体尾
        clone.snake.pop();
        // 添加新克隆体头
        clone.snake.unshift(head);
    });
}

// 绘制游戏
function drawGame() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制粒子
    updateParticles();
    drawParticles();
    
    // 绘制蛇
    for (let i = 0; i < snake.length; i++) {
        const segment = snake[i];
        
        if (skins[currentSkin].name === '蜘蛛侠') {
            // 蜘蛛侠皮肤
            const gradient = ctx.createLinearGradient(segment.x, segment.y, segment.x + 10, segment.y + 10);
            gradient.addColorStop(0, 'red');
            gradient.addColorStop(1, 'blue');
            ctx.fillStyle = gradient;
        } else if (skins[currentSkin].name === '钢铁侠') {
            // 钢铁侠皮肤
            const gradient = ctx.createLinearGradient(segment.x, segment.y, segment.x + 10, segment.y + 10);
            gradient.addColorStop(0, 'red');
            gradient.addColorStop(1, 'gold');
            ctx.fillStyle = gradient;
        } else if (skins[currentSkin].name === '彩虹皮肤') {
            // 彩虹皮肤
            const gradient = ctx.createLinearGradient(segment.x, segment.y, segment.x + 10, segment.y + 10);
            gradient.addColorStop(0, 'red');
            gradient.addColorStop(1/6, 'orange');
            gradient.addColorStop(2/6, 'yellow');
            gradient.addColorStop(3/6, 'green');
            gradient.addColorStop(4/6, 'blue');
            gradient.addColorStop(5/6, 'indigo');
            gradient.addColorStop(1, 'violet');
            ctx.fillStyle = gradient;
        } else if (skins[currentSkin].name === '霓虹皮肤') {
            // 霓虹皮肤
            const gradient = ctx.createLinearGradient(segment.x, segment.y, segment.x + 10, segment.y + 10);
            gradient.addColorStop(0, '#00FFFF');
            gradient.addColorStop(0.5, '#00FF00');
            gradient.addColorStop(1, '#FF00FF');
            ctx.fillStyle = gradient;
        } else if (skins[currentSkin].name === '森林皮肤') {
            // 森林皮肤
            const gradient = ctx.createLinearGradient(segment.x, segment.y, segment.x + 10, segment.y + 10);
            gradient.addColorStop(0, '#2E7D32');
            gradient.addColorStop(0.5, '#4CAF50');
            gradient.addColorStop(1, '#81C784');
            ctx.fillStyle = gradient;
        } else if (skins[currentSkin].name === '海洋皮肤') {
            // 海洋皮肤
            const gradient = ctx.createLinearGradient(segment.x, segment.y, segment.x + 10, segment.y + 10);
            gradient.addColorStop(0, '#1565C0');
            gradient.addColorStop(0.5, '#2196F3');
            gradient.addColorStop(1, '#64B5F6');
            ctx.fillStyle = gradient;
        } else if (skins[currentSkin].name === '火焰皮肤') {
            // 火焰皮肤
            const gradient = ctx.createLinearGradient(segment.x, segment.y, segment.x + 10, segment.y + 10);
            gradient.addColorStop(0, '#C62828');
            gradient.addColorStop(0.5, '#E53935');
            gradient.addColorStop(1, '#FF5252');
            ctx.fillStyle = gradient;
        } else {
            // 普通皮肤
            ctx.fillStyle = skins[currentSkin].color;
        }
        
        ctx.fillRect(segment.x, segment.y, 10, 10);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(segment.x, segment.y, 10, 10);
    }
    
    // 给玩家蛇头添加皇冠标识
    const head = snake[0];
    ctx.fillStyle = '#FFD700';
    ctx.font = '12px Arial';
    ctx.fillText('👑', head.x - 2, head.y - 2);
    
    // 绘制克隆体
    clones.forEach(clone => {
        for (let i = 0; i < clone.snake.length; i++) {
            const segment = clone.snake[i];
            
            // 克隆体使用半透明效果
            ctx.fillStyle = 'rgba(102, 126, 234, 0.7)';
            ctx.fillRect(segment.x, segment.y, 10, 10);
            ctx.strokeStyle = 'rgba(102, 126, 234, 0.9)';
            ctx.strokeRect(segment.x, segment.y, 10, 10);
        }
    });
    
    // 绘制 AI 蛇
    aiSnakes.forEach(ai => {
        if (!ai.isAlive) return;
        for (let i = 0; i < ai.snake.length; i++) {
            const segment = ai.snake[i];
            ctx.fillStyle = ai.color;
            ctx.fillRect(segment.x, segment.y, 10, 10);
            ctx.strokeStyle = '#333';
            ctx.strokeRect(segment.x, segment.y, 10, 10);
        }
    });
    
    // 绘制食物（乱斗模式有多个食物）
    const allFoods = gameMode === 'battle' ? foods : [food];
    allFoods.forEach(f => {
        if (!f) return;
        const foodGradient = ctx.createLinearGradient(f.x, f.y, f.x + 10, f.y + 10);
        foodGradient.addColorStop(0, '#FF6B6B');
        foodGradient.addColorStop(1, '#FF8E53');
        ctx.fillStyle = foodGradient;
        ctx.fillRect(f.x, f.y, 10, 10);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(f.x, f.y, 10, 10);
    });
}

// 更新游戏状态
let timeSinceLastMove = 0;
// 速度随长度平滑增长：每长一节提速约 1.8%，下限随难度；加速技能按倍率叠加
function currentInterval() {
    const grown = Math.max(0, snake.length - 3);
    let ms = Math.max(DIFFICULTY[difficulty].min, baseSpeed * Math.pow(0.982, grown));
    if (skills.speed.active) ms /= 2;
    return ms;
}
function updateGame(timestamp) {
    if (isPaused) {
        lastTime = timestamp;
        timeSinceLastMove = 0;
        animationId = requestAnimationFrame(updateGame);
        return;
    }

    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    timeSinceLastMove += deltaTime;

    // 只有当累积时间达到游戏速度时才移动
    if (timeSinceLastMove < currentInterval()) {
        animationId = requestAnimationFrame(updateGame);
        return;
    }
    
    timeSinceLastMove = 0;

    // 乱斗模式：更新 AI 蛇
    if (gameMode === 'battle') {
        aiSnakes.forEach(ai => {
            ai.decideDirection();
            ai.move();
        });
    }
    
    // 移动蛇头
    let head = { x: snake[0].x, y: snake[0].y };
    
    switch (direction) {
        case 'up':
            head.y -= 10;
            break;
        case 'down':
            head.y += 10;
            break;
        case 'left':
            head.x -= 10;
            break;
        case 'right':
            head.x += 10;
            break;
    }
    
    // 检查边界碰撞（穿墙模式或穿墙技能生效时从对侧穿出）
    if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
        if (!skills.wall.active && !wrapMode) {
            gameOver();
            return;
        }
        if (head.x < 0) head.x = canvas.width - 10;
        if (head.x >= canvas.width) head.x = 0;
        if (head.y < 0) head.y = canvas.height - 10;
        if (head.y >= canvas.height) head.y = 0;
    }
    
    // 检查自身碰撞
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            gameOver();
            return;
        }
    }
    
    // 乱斗模式：检查与 AI 蛇的碰撞
    if (gameMode === 'battle') {
        for (let ai of aiSnakes) {
            if (!ai.isAlive) continue;
            // 检查是否撞到 AI 蛇身体（从第 1 节开始检查，不检查头）
            for (let i = 1; i < ai.snake.length; i++) {
                if (head.x === ai.snake[i].x && head.y === ai.snake[i].y) {
                    gameOver();
                    return;
                }
            }
            // 检查 AI 蛇头是否撞到玩家（头对头碰撞，双方都死）
            if (head.x === ai.snake[0].x && head.y === ai.snake[0].y) {
                ai.isAlive = false;
                // 头对头碰撞，玩家也應該結束
                gameOver();
                return;
            }
        }
    }
    
    // 检查食物碰撞（支持多个食物）
    const allFoods = gameMode === 'battle' ? foods : [food];
    let ate = false;
    for (let i = 0; i < allFoods.length; i++) {
        if (head.x === allFoods[i].x && head.y === allFoods[i].y) {
            score += 10;
            coins += 5;
            if (Math.random() < 0.1) { // 10% 几率获得钻石
                diamonds += 1;
                stats.totalDiamonds += 1;
                updateAchievements();
            }
            
            // 播放吃食物音效
            eatSound.play().catch(e => console.log('吃食物音效播放失败:', e));

            // 创建粒子效果（在吃到的那颗食物处）
            createParticles(allFoods[i].x, allFoods[i].y, 10, '#FF6B6B');
            
            if (gameMode === 'battle') {
                foods.splice(i, 1);
                generateFood(); // 乱斗模式立即生成新食物
            }
            ate = true;
            break;
        }
    }
    
    if (!ate) {
        // 移除蛇尾
        snake.pop();
    }
    
    // 添加新蛇头
    snake.unshift(head);
    
    // 更新游戏信息
    updateGameInfo();
    
    // 乱斗模式更新实时排行榜
    if (gameMode === 'battle') {
        updateLiveLeaderboard();
    }
    
    // 更新克隆体
    updateClones();
    
    // 检查挑战模式胜利条件
    if (gameMode === 'challenge' && score >= challengeScore) {
        // 挑战模式胜利
        if (animationId) cancelAnimationFrame(animationId);
        if (timeInterval) clearInterval(timeInterval);
        
        // 停止背景音乐
        bgMusic.pause();
        bgMusic.currentTime = 0;
        
        // 播放游戏结束音效
        gameOverSound.play().catch(e => console.log('游戏结束音效播放失败:', e));
        
        // 保存存档（含金币/钻石/最高分）
        if (score > highScore) {
            highScore = score;
        }
        persistSave();
        
        // 更新统计数据
        stats.gamesPlayed++;
        stats.totalScore += score;
        if (snake.length > stats.maxLength) {
            stats.maxLength = snake.length;
        }
        
        // 更新排行榜
        updateLeaderboard(score);
        
        // 更新成就
        updateAchievements();
        
        // 显示游戏结束界面
        document.getElementById('finalScore').textContent = score;
        document.getElementById('highScore').textContent = highScore;
        document.getElementById('finalLength').textContent = snake.length;
        
        // 修改游戏结束标题为胜利
        const gameOverTitle = document.querySelector('.game-over h2');
        gameOverTitle.textContent = '挑战成功！';
        
        document.getElementById('gameOver').style.display = 'block';
        return;
    }
    
    // 绘制游戏
    drawGame();
    
    // 更新技能冷却时间
    Object.keys(skills).forEach(skillName => {
        const skill = skills[skillName];
        if (skill.cooldown > 0) {
            skill.cooldown--;
        }
    });
    
    // 更新技能UI
    updateSkillUI();
    
    // 继续游戏循环
    animationId = requestAnimationFrame(updateGame);
}

// 更新游戏信息
function updateGameInfo() {
    document.getElementById('score').textContent = score;
    document.getElementById('coins').textContent = coins;
    document.getElementById('diamonds').textContent = diamonds;
    document.getElementById('length').textContent = snake.length;
    // 常规模式显示"--"，乱斗模式显示倒计时
    document.getElementById('time').textContent = gameMode === 'battle' ? timeLeft : '--';
}

// 更新实时排行榜
function updateLiveLeaderboard() {
    const leaderboardEl = document.getElementById('liveLeaderboard');
    
    // 乱斗模式才显示
    if (gameMode !== 'battle') {
        leaderboardEl.style.display = 'none';
        return;
    }
    
    leaderboardEl.style.display = 'block';
    
    // 收集所有玩家的分数（包括失败的 AI）
    let allScores = [{ name: playerName, score: score, isPlayer: true }];
    aiSnakes.forEach(ai => {
        // 所有 AI 都显示在排行榜上，无论是否存活
        allScores.push({ name: ai.name, score: ai.score, isPlayer: false });
    });
    
    // 按分数排序
    allScores.sort((a, b) => b.score - a.score);
    
    // 生成 HTML
    let html = '<h4>🏆 实时排名</h4>';
    allScores.forEach((s, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        // 失败的 AI 显示灰色
        const ai = aiSnakes.find(ai => ai.name === s.name);
        const isAlive = ai ? ai.isAlive : false;
        html += `
            <div class="live-leaderboard-item ${s.isPlayer ? 'player' : 'ai'}" style="${!s.isPlayer && !isAlive ? 'opacity: 0.5;' : ''}">
                <span>${medal} ${s.name}${!s.isPlayer && !isAlive ? ' 💀' : ''}</span>
                <span>${s.score}分</span>
            </div>
        `;
    });
    
    leaderboardEl.innerHTML = html;
    
    // 更新计时器显示（在排行榜上显示剩余时间）
    const timeDisplay = document.createElement('div');
    timeDisplay.style.cssText = 'margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.3); text-align: center; color: #FF6B6B; font-weight: bold;';
    timeDisplay.textContent = `⏱️ 剩余：${timeLeft}秒`;
    leaderboardEl.appendChild(timeDisplay);
}

// 游戏结束
function gameOver() {
    // 清除动画和计时器
    if (animationId) cancelAnimationFrame(animationId);
    if (timeInterval) clearInterval(timeInterval);
    
    // 隐藏技能按钮
    document.querySelector('.skills').style.opacity = '0';
    
    // 清空粒子
    particles = [];
    
    // 清空克隆体
    clones = [];
    
    // 停止背景音乐
    bgMusic.pause();
    bgMusic.currentTime = 0;
    
    // 播放游戏结束音效
    gameOverSound.play().catch(e => console.log('游戏结束音效播放失败:', e));

    // 保存存档（含金币/钻石/最高分）
    if (score > highScore) {
        highScore = score;
    }
    persistSave();
    
    // 更新统计数据
    stats.gamesPlayed++;
    stats.totalScore += score;
    if (snake.length > stats.maxLength) {
        stats.maxLength = snake.length;
    }
    
    // 更新排行榜
    updateLeaderboard(score);
    
    // 更新成就
    updateAchievements();
    
    // 显示游戏结束界面
    document.getElementById('finalScore').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('finalLength').textContent = snake.length;
    
    // 恢复游戏结束标题
    const gameOverTitle = document.querySelector('.game-over h2');
    
    // 乱斗模式时间到显示排名
    if (gameMode === 'battle' && timeLeft <= 0) {
        gameOverTitle.textContent = '时间到！';
        // 计算 AI 蛇的最终得分
        let aiScores = aiSnakes.filter(ai => ai.isAlive).map(ai => ({ name: ai.name, score: ai.score }));
        aiScores.sort((a, b) => b.score - a.score);
        
        let ranking = '最终排名:\n';
        let allScores = [{ name: playerName, score: score }, ...aiScores];
        allScores.sort((a, b) => b.score - a.score);
        
        allScores.forEach((s, i) => {
            ranking += `${i + 1}. ${s.name}: ${s.score}分\n`;
        });
        
        // 在游戏结束界面显示排名
        const rankingEl = document.createElement('div');
        rankingEl.id = 'finalRanking';
        rankingEl.style.cssText = 'margin-top: 15px; white-space: pre-line; color: #fff; font-size: 14px;';
        rankingEl.textContent = ranking;
        
        // 移除旧的排名显示
        const oldRanking = document.getElementById('finalRanking');
        if (oldRanking) oldRanking.remove();
        
        document.querySelector('.game-over').appendChild(rankingEl);
    } else {
        gameOverTitle.textContent = '游戏结束';
    }
    
    document.getElementById('gameOver').style.display = 'block';
}

// 开始游戏
function startGame() {
    // 清除之前的动画和计时器
    if (animationId) cancelAnimationFrame(animationId);
    if (timeInterval) clearInterval(timeInterval);
    
    // 初始化游戏
    initGame();
    
    isPaused = false;
    
    // 隐藏开始按钮
    const startBtn = document.querySelector('.start-game-btn');
    if (startBtn) {
        startBtn.style.display = 'none';
    }
    
    // 显示技能按钮
    document.querySelector('.skills').style.opacity = '1';
    
    // 播放背景音乐
    bgMusic.play().catch(e => console.log('背景音乐播放失败:', e));
    
    // 乱斗模式启动计时器
    if (gameMode === 'battle') {
        timeLeft = 180; // 3 分钟
        updateGameInfo();
        timeInterval = setInterval(function() {
            if (!isPaused) {
                timeLeft--;
                updateGameInfo();
                if (timeLeft <= 0) {
                    gameOver();
                }
            }
        }, 1000);
    }
    
    // 重置时间累积器
    timeSinceLastMove = 0;
    lastTime = 0;
    
    // 开始游戏循环
    animationId = requestAnimationFrame(updateGame);
}

// 关闭游戏结束界面
function closeGameOver() {
    document.getElementById('gameOver').style.display = 'none';
    // 隐藏技能按钮
    document.querySelector('.skills').style.opacity = '0';
    
    // 显示开始游戏按钮
    const startBtn = document.querySelector('.start-game-btn');
    if (startBtn) {
        startBtn.style.display = 'block';
    }
}

// 暂停游戏
function pauseGame() {
    isPaused = !isPaused;
}

// 重置游戏
function resetGame() {
    if (animationId) cancelAnimationFrame(animationId);
    if (timeInterval) clearInterval(timeInterval);

    // 重置技能
    skills = {
        speed: { active: false, cooldown: 0, maxCooldown: 10 },
        wall: { active: false, cooldown: 0, maxCooldown: 15 },
        clone: { active: false, cooldown: 0, maxCooldown: 20 }
    };
    
    // 清空粒子
    particles = [];
    
    // 清空克隆体
    clones = [];
    
    initGame();
    startGame();
}

// 设置难度
function setDifficulty(level) {
    if (!DIFFICULTY[level]) return;
    difficulty = level;
    baseSpeed = DIFFICULTY[level].base;
    settings.difficulty = level;
    persistSettings();

    // 更新难度按钮状态
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-difficulty="${level}"]`).classList.add('active');
}

// 选择皮肤
function selectSkin(skinIndex) {
    currentSkin = skinIndex;
    persistSave();
    
    // 更新UI
    document.querySelectorAll('.skin-item').forEach(item => {
        item.classList.remove('selected');
    });
    document.querySelector(`[data-skin="${skinIndex}"]`).classList.add('selected');
    
    // 重新绘制游戏
    drawGame();
}

// 购买皮肤
function buySkin(skinIndex) {
    const skin = skins[skinIndex];
    
    if (skin.currency === 'coins') {
        if (coins >= skin.price) {
            // 扣除金币
            coins -= skin.price;
            document.getElementById('coins').textContent = coins;
        } else {
            alert('金币不足！');
            return;
        }
    } else if (skin.currency === 'diamonds') {
        if (diamonds >= skin.price) {
            // 扣除钻石
            diamonds -= skin.price;
            document.getElementById('diamonds').textContent = diamonds;
        } else {
            alert('钻石不足！');
            return;
        }
    }

    // 播放购买音效
    buySound.play().catch(e => console.log('购买音效播放失败:', e));

    // 标记为已拥有
    skin.owned = true;
    persistSave();
    
    // 更新统计数据
    stats.skinsPurchased++;
    updateAchievements();
    
    // 更新UI
    const skinItem = document.querySelector(`[data-skin="${skinIndex}"]`);
    skinItem.classList.remove('locked');
    skinItem.querySelector('.skin-price').textContent = '已拥有';
    
    // 自动选择购买的皮肤
    selectSkin(skinIndex);
}

// 键盘控制
document.addEventListener('keydown', function(e) {
    // 输入框打字时不触发游戏快捷键
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    // 阻止箭头键和空格的默认行为（防止页面滚动）
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }

    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            if (direction !== 'down') direction = 'up';
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            if (direction !== 'up') direction = 'down';
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            if (direction !== 'right') direction = 'left';
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            if (direction !== 'left') direction = 'right';
            break;
        case ' ':
        case 'p':
        case 'P':
            pauseGame();
            break;
        case 'r':
        case 'R':
            // 对局中/结算时快速重开
            if (animationId) resetGame();
            break;
        case 'm':
        case 'M':
            setMuted(!settings.muted);
            break;
        case 'Enter':
            if (!animationId) startGame();
            break;
    }
});

// 设置游戏模式
function setGameMode(mode) {
    if (!['classic', 'battle'].includes(mode)) return;
    gameMode = mode;
    settings.mode = mode;
    persistSettings();

    // 更新模式按钮状态
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');

    // 只初始化游戏，不启动
    initGame();
}

// 穿墙模式（配置开关，持久化）
function setWrapMode(on) {
    wrapMode = Boolean(on);
    settings.wrapMode = wrapMode;
    persistSettings();
    const onBtn = document.getElementById('wrapOn');
    const offBtn = document.getElementById('wrapOff');
    if (onBtn && offBtn) {
        onBtn.classList.toggle('active', wrapMode);
        offBtn.classList.toggle('active', !wrapMode);
    }
}

// 静音开关（M 键，持久化）
const audioEls = [bgMusic, eatSound, gameOverSound, skillSound, buySound];
function setMuted(muted) {
    settings.muted = Boolean(muted);
    persistSettings();
    audioEls.forEach(a => { a.muted = settings.muted; });
}

// 难度选择
document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        setDifficulty(this.dataset.difficulty);
    });
});

// 游戏模式选择
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        setGameMode(this.dataset.mode);
    });
});

// 穿墙模式开关
document.getElementById('wrapOn').addEventListener('click', function() { setWrapMode(true); });
document.getElementById('wrapOff').addEventListener('click', function() { setWrapMode(false); });

// 使用技能
function useSkill(skillName) {
    const skill = skills[skillName];
    if (skill.cooldown === 0 && !skill.active) {
        // 播放技能音效
        skillSound.play().catch(e => console.log('技能音效播放失败:', e));
        
        // 更新统计数据
        stats.skillsUsed++;
        updateAchievements();
        
        switch (skillName) {
            case 'speed':
                // 加速：5 秒内移动间隔减半（由 currentInterval 按倍率计算）
                skill.active = true;
                setTimeout(() => {
                    skill.active = false;
                }, 5000); // 持续5秒
                break;
            case 'wall':
                skill.active = true;
                setTimeout(() => {
                    skill.active = false;
                }, 3000); // 持续3秒
                break;
            case 'clone':
                skill.active = true;
                // 复制蛇的当前状态
                const clone = JSON.parse(JSON.stringify(snake));
                // 让克隆体向相反方向移动
                let cloneDirection = direction;
                switch (direction) {
                    case 'up': cloneDirection = 'down'; break;
                    case 'down': cloneDirection = 'up'; break;
                    case 'left': cloneDirection = 'right'; break;
                    case 'right': cloneDirection = 'left'; break;
                }
                // 添加克隆体
                clones.push({ snake: clone, direction: cloneDirection, startTime: Date.now() });
                // 克隆体移动逻辑可以在updateGame中处理
                setTimeout(() => {
                    skill.active = false;
                    // 清空克隆体
                    clones = [];
                }, 4000); // 持续4秒
                break;
        }
        
        // 设置冷却时间
        skill.cooldown = skill.maxCooldown;
        updateSkillUI();
    }
}

// 更新技能UI
function updateSkillUI() {
    Object.keys(skills).forEach(skillName => {
        const skill = skills[skillName];
        const btn = document.querySelector(`[data-skill="${skillName}"]`);
        
        if (skill.active) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
        
        if (skill.cooldown > 0) {
            btn.classList.add('cooldown');
            const skillNames = { speed: '加速', wall: '穿墙', clone: '分身' };
            btn.textContent = `${skillNames[skillName]} (${skill.cooldown})`;
        } else {
            btn.classList.remove('cooldown');
            const skillNames = { speed: '加速', wall: '穿墙', clone: '分身' };
            btn.textContent = skillNames[skillName];
        }
    });
}

// 皮肤选择
document.querySelectorAll('.skin-item').forEach(item => {
    item.addEventListener('click', function() {
        const skinIndex = parseInt(this.dataset.skin);
        const skin = skins[skinIndex];
        
        if (skin.owned) {
            selectSkin(skinIndex);
        } else {
            buySkin(skinIndex);
        }
    });
});

// 初始化游戏
initGame();
drawGame();

// 更新排行榜
function updateLeaderboard(newScore) {
    // 添加新分数到排行榜
    leaderboard.push({
        name: playerName,
        score: newScore,
        date: new Date().toLocaleString()
    });
    
    // 按分数排序（降序）
    leaderboard.sort((a, b) => b.score - a.score);
    
    // 只保留前10名
    leaderboard = leaderboard.slice(0, 10);

    persistSave();

    // 更新显示
    displayLeaderboard();
}

// 显示排行榜
function displayLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = '';
    
    if (leaderboard.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'leaderboard-item';
        emptyItem.innerHTML = '<div class="leaderboard-rank">-</div><div class="leaderboard-name">暂无数据</div><div class="leaderboard-score">0</div>';
        leaderboardList.appendChild(emptyItem);
        return;
    }
    
    leaderboard.forEach((item, index) => {
        const leaderboardItem = document.createElement('div');
        leaderboardItem.className = `leaderboard-item ${index < 3 ? 'top-3' : ''}`;
        leaderboardItem.innerHTML = `
            <div class="leaderboard-rank">${index + 1}</div>
            <div class="leaderboard-name">${item.name}</div>
            <div class="leaderboard-score">${item.score}</div>
        `;
        leaderboardList.appendChild(leaderboardItem);
    });
}

// 显示最高分
document.getElementById('highScore').textContent = highScore;

// 更新成就
function updateAchievements() {
    // 检查各项成就
    if (stats.gamesPlayed >= 1 && !achievements[0].completed) {
        achievements[0].completed = true;
    }
    if (stats.totalScore >= 100 && !achievements[1].completed) {
        achievements[1].completed = true;
    }
    if (stats.totalScore >= 500 && !achievements[2].completed) {
        achievements[2].completed = true;
    }
    if (stats.totalScore >= 1000 && !achievements[3].completed) {
        achievements[3].completed = true;
    }
    if (stats.skinsPurchased >= 5 && !achievements[4].completed) {
        achievements[4].completed = true;
    }
    if (stats.skillsUsed >= 10 && !achievements[5].completed) {
        achievements[5].completed = true;
    }
    if (stats.maxLength >= 20 && !achievements[6].completed) {
        achievements[6].completed = true;
    }
    if (stats.totalDiamonds >= 100 && !achievements[7].completed) {
        achievements[7].completed = true;
    }
    
    // 保存成就和统计数据
    persistSave();
    
    // 更新显示
    displayAchievements();
}

// 显示成就
function displayAchievements() {
    const achievementsList = document.getElementById('achievementsList');
    achievementsList.innerHTML = '';
    
    achievements.forEach(achievement => {
        const achievementItem = document.createElement('div');
        achievementItem.className = `achievement-item ${achievement.completed ? 'completed' : ''}`;
        achievementItem.innerHTML = `
            <div class="achievement-name">${achievement.name}</div>
            <div class="achievement-status ${achievement.completed ? 'completed' : 'incomplete'}">${achievement.completed ? '已完成' : '未完成'}</div>
        `;
        achievementsList.appendChild(achievementItem);
    });
}

// 初始化成就显示
displayAchievements();

// 初始化排行榜显示
displayLeaderboard();

// 初始化商城
function initMall() {
    const 商城Items = document.getElementById('商城Items');
    商城Items.innerHTML = '';
    
    商城物品.forEach(item => {
        const 商城Item = document.createElement('div');
        商城Item.className = '商城-item';
        商城Item.innerHTML = `
            <div class="商城-item-name">${item.name}</div>
            <div class="商城-item-price">${item.price} ${item.currency === 'coins' ? '金币' : '钻石'}</div>
            <button class="商城-item-button" onclick="buyMallItem(${item.id})" ${(item.currency === 'coins' && coins < item.price) || (item.currency === 'diamonds' && diamonds < item.price) ? 'disabled' : ''}>购买</button>
        `;
        商城Items.appendChild(商城Item);
    });
}

// 购买商城物品
function buyMallItem(itemId) {
    const item = 商城物品.find(i => i.id === itemId);
    if (!item) return;
    
    if (item.currency === 'coins') {
        if (coins >= item.price) {
            coins -= item.price;
            document.getElementById('coins').textContent = coins;
        } else {
            alert('金币不足！');
            return;
        }
    } else if (item.currency === 'diamonds') {
        if (diamonds >= item.price) {
            diamonds -= item.price;
            document.getElementById('diamonds').textContent = diamonds;
        } else {
            alert('钻石不足！');
            return;
        }
    }
    
    // 播放购买音效
    buySound.play().catch(e => console.log('购买音效播放失败:', e));
    
    // 应用物品效果
    switch (item.type) {
        case 'coins':
            coins += item.value;
            document.getElementById('coins').textContent = coins;
            break;
        case 'diamonds':
            diamonds += item.value;
            document.getElementById('diamonds').textContent = diamonds;
            break;
        case 'skill_cooldown':
            Object.keys(skills).forEach(skillName => {
                skills[skillName].maxCooldown *= item.value;
            });
            break;
    }

    persistSave();

    // 重新初始化商城
    initMall();
}

// 初始化商城
initMall();

// 页面切换函数
function switchPage(pageId, btn) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // 显示选中的页面
    document.getElementById(pageId).classList.add('active');

    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.remove('active');
    });

    // 激活当前导航按钮
    if (btn) btn.classList.add('active');
}

// 显示名字输入框
function showNameInput() {
    // 隐藏开始按钮
    const startBtn = document.querySelector('.start-game-btn');
    if (startBtn) {
        startBtn.style.display = 'none';
    }
    
    // 显示名字输入框
    const nameModal = document.getElementById('nameInputModal');
    nameModal.style.display = 'flex';
    document.getElementById('playerName').focus();
}

// 关闭名字输入弹窗
function closeNameInput() {
    document.getElementById('nameInputModal').style.display = 'none';
}

// 确认名字并开始游戏
function confirmName() {
    const nameInput = document.getElementById('playerName');
    const name = nameInput.value.trim();
    if (name) {
        playerName = name;
        persistSave();
        document.getElementById('nameInputModal').style.display = 'none';
        document.getElementById('gameControlModal').style.display = 'none';
        startGame();
    } else {
        alert('请输入有效的名字');
    }
}

// 显示游戏控制弹窗
function showGameControlModal() {
    document.getElementById('gameControlModal').style.display = 'block';
}

// 关闭游戏控制弹窗
function closeGameControlModal() {
    document.getElementById('gameControlModal').style.display = 'none';
}

// 初始化玩家名字输入框
document.getElementById('playerName').value = playerName;

// ============ 启动：应用持久化设置 ============
setDifficulty(difficulty);
setWrapMode(wrapMode);
setMuted(settings.muted);
setGameMode(gameMode); // 内部会按当前模式 initGame()
