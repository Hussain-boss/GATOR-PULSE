import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Zap } from 'lucide-react';
import { GameState, GameStatus, Difficulty } from '../types';

interface AlligatorGameProps {
  onNeuralLinkTrigger?: (active: boolean) => void;
}

export default function AlligatorGame({ onNeuralLinkTrigger }: AlligatorGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    status: 'idle',
    highscore: Number(localStorage.getItem('gator-highscore')) || 0,
    coins: 0,
    level: 1,
    isNeuralLinked: false,
    difficulty: 'medium',
    isInvincible: false,
    scoreMultiplier: 1,
  });

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
    // Notify parent about neural link state
    onNeuralLinkTrigger?.(gameState.isNeuralLinked);
  }, [gameState, onNeuralLinkTrigger]);

  // Game loop variables
  const playerRef = useRef({ y: 150, targetY: 150, normalizedY: 0.5, width: 60, height: 20 });
  const obstaclesRef = useRef<{ 
    x: number, 
    y: number, 
    w: number, 
    h: number, 
    type: 'gator' | 'toxic' | 'shark' | 'rift' | 'coin',
    speedY?: number,
    angle?: number
  }[]>([]);
  const frameRef = useRef(0);
  const levelStartFrameRef = useRef(0);
  const powerupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const neuralTimerRef = useRef<NodeJS.Timeout | null>(null);
  const shakeRef = useRef(0);
  const particlesRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
  }[]>([]);

  const getRizzMessage = (score: number) => {
    if (score < 100) return "L + Ratio. Skill Issue. Go touch grass.";
    if (score < 500) return "Mid behavior. NPC energy. Chat, is he even trying?";
    if (score < 1500) return "Wait, you're actually cooking. Respect the grind.";
    return "Certified Sigma. Gator God Status. Final Boss Energy.";
  };

  const getThemeColor = (level: number) => {
    const colors = ['#39FF14', '#00f3ff', '#FF00E5', '#ffff00', '#ff0000'];
    return colors[(level - 1) % colors.length];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;

    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        // Re-calculate absolute Y based on previous normalized ratio
        const newY = canvas.height * playerRef.current.normalizedY;
        playerRef.current.targetY = Math.max(20, Math.min(canvas.height - 20, newY));
        playerRef.current.y = playerRef.current.targetY;
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    // Initial size
    handleResize();

    window.addEventListener('orientationchange', () => {
        setTimeout(handleResize, 100);
    });

    const emitParticles = (x: number, y: number, color: string, count: number = 15, baseSize: number = 3) => {
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x, 
          y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 1.0,
          color,
          size: Math.random() * baseSize + 1
        });
      }
    };

    const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
      if (gameStateRef.current.status !== 'playing') return;
      
      let clientY: number;
      if ('touches' in e) {
        clientY = (e as TouchEvent).touches[0].clientY;
      } else {
        clientY = (e as MouseEvent).clientY;
      }

      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const y = clientY - rect.top;
          
          // Normalized logical bounds
          const safeCanvasHeight = Math.max(100, canvas.height); // prevent zeroes
          const minBoundedY = Math.max(20, Math.min(safeCanvasHeight - 20, y));
          playerRef.current.targetY = minBoundedY;
          playerRef.current.normalizedY = minBoundedY / safeCanvasHeight; // Store percentage
      }
    };

    const preventDefaultTouch = (e: TouchEvent) => {
       if (gameStateRef.current.status === 'playing') {
           e.preventDefault();
       }
    };

    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('touchmove', handleGlobalMove, { passive: false });
    // Prevent scrolling when touching the game area
    canvas.addEventListener('touchstart', preventDefaultTouch, { passive: false });
    canvas.addEventListener('touchmove', preventDefaultTouch, { passive: false });

    const spawnEntity = () => {
      const rand = Math.random();
      let type: any = 'gator';
      
      const timeSinceLevelStart = (frameRef.current - levelStartFrameRef.current) / 60;
      const canSpawnShark = gameStateRef.current.level >= 2 && timeSinceLevelStart <= 15;

      if (rand < 0.25) type = 'coin';
      else if (rand < 0.35) type = 'rift';
      else if (rand < 0.50 && canSpawnShark) type = 'shark';
      else if (rand < 0.65) type = 'toxic';

      
      const entity = {
        x: canvas.width + 100,
        y: Math.random() * (canvas.height - 40) + 20,
        w: type === 'coin' ? 20 : (type === 'shark' ? 100 : 40),
        h: type === 'coin' ? 20 : (type === 'shark' ? 40 : 40),
        type,
        speedY: type === 'shark' ? 2 : 0,
        angle: 0
      };
      
      obstaclesRef.current.push(entity);
    };

    const drawPlayer = (p: typeof playerRef.current, theme: string) => {
      ctx.shadowBlur = gameStateRef.current.isNeuralLinked ? 25 : 15;
      
      const px = 50; 
      // Ensure player is always strictly visible in bounds
      const safeY = Math.max(p.height, Math.min(canvas.height - p.height, p.y || canvas.height/2));

      if (gameStateRef.current.isInvincible) {
        ctx.shadowColor = '#00F3FF';
        ctx.strokeStyle = '#00F3FF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(px + p.width/2, safeY, p.width + 10, p.height + 10, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.shadowColor = theme;
      ctx.fillStyle = theme;
      // Fallback manual rounded rect for cross-browser safety
      const r = 5;
      ctx.beginPath();
      ctx.moveTo(px + r, safeY - p.height/2);
      ctx.lineTo(px + p.width - r, safeY - p.height/2);
      ctx.quadraticCurveTo(px + p.width, safeY - p.height/2, px + p.width, safeY - p.height/2 + r);
      ctx.lineTo(px + p.width, safeY + p.height/2 - r);
      ctx.quadraticCurveTo(px + p.width, safeY + p.height/2, px + p.width - r, safeY + p.height/2);
      ctx.lineTo(px + r, safeY + p.height/2);
      ctx.quadraticCurveTo(px, safeY + p.height/2, px, safeY + p.height/2 - r);
      ctx.lineTo(px, safeY - p.height/2 + r);
      ctx.quadraticCurveTo(px, safeY - p.height/2, px + r, safeY - p.height/2);
      ctx.closePath();
      ctx.fill();

      // Snapping jaws
      ctx.beginPath();
      ctx.moveTo(px, safeY);
      ctx.lineTo(px - 30, safeY + Math.sin(frameRef.current * 0.1) * 5);
      ctx.strokeStyle = theme;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Eye
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(px + 40, safeY - 3, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Safety net debug
      if (safeY < 0 || safeY > canvas.height) {
        console.warn("Safety Check: Alligator was out of bounds! Drawing fallback.");
        ctx.fillStyle = "#39FF14"; // Neon green square fallback
        ctx.fillRect(50, 50, 50, 50);
      }
    };

    const drawEntity = (obs: any) => {
      ctx.shadowBlur = 10;
      if (obs.type === 'gator') {
        ctx.shadowColor = '#FF00E5';
        ctx.fillStyle = '#FF00E5';
        ctx.fillRect(obs.x, obs.y - obs.h/2, obs.w, obs.h);
      } else if (obs.type === 'toxic') {
        ctx.shadowColor = '#00F3FF';
        ctx.fillStyle = '#00F3FF';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w/2, obs.y, obs.w/2, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'shark') {
        ctx.shadowColor = '#ff3e3e';
        ctx.fillStyle = '#ff3e3e';
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.w, obs.y);
        ctx.lineTo(obs.x, obs.y - obs.h/2);
        ctx.lineTo(obs.x, obs.y + obs.h/2);
        ctx.closePath();
        ctx.fill();
      } else if (obs.type === 'coin') {
        ctx.shadowColor = '#FFD700';
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(obs.x + obs.w/2, obs.y, obs.w/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText('$', obs.x + 6, obs.y + 4);
      } else if (obs.type === 'rift') {
        ctx.shadowColor = '#fff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(obs.x + obs.w/2, obs.y, obs.w/2, obs.h, frameRef.current * 0.05, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const loop = () => {
      ctx.fillStyle = '#020202';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const theme = getThemeColor(gameStateRef.current.level);
      const intensity = (window as any).NEO_INTENSITY || 0;

      ctx.save();
      // Apply Screen Shake
      if (shakeRef.current > 0) {
        const sx = (Math.random() - 0.5) * shakeRef.current;
        const sy = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(sx, sy);
        shakeRef.current -= 0.5;
      }

      // Draw Grid Background
      ctx.strokeStyle = theme + '11';
      ctx.lineWidth = 1;
      const scrollOffset = (frameRef.current * (2 + intensity * 10)) % 30;
      for (let i = -30; i < canvas.width + 30; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i - scrollOffset, 0);
        ctx.lineTo(i - scrollOffset, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 30) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      if (gameStateRef.current.status === 'playing') {
        frameRef.current++;

        // Speed calculation: basic + intensity factor + level factor
        const speedMap = { easy: 0.8, medium: 1, hard: 1.2 };
        const diffMultiplier = speedMap[gameStateRef.current.difficulty];
        let baseSpeed = (4 + (gameStateRef.current.level * 1.5) + (intensity * 15)) * diffMultiplier;
        if (gameStateRef.current.isNeuralLinked) baseSpeed *= 0.5;

        // Level Up check
        const nextLevel = Math.floor(gameStateRef.current.score / 500) + 1;
        if (nextLevel > gameStateRef.current.level) {
          levelStartFrameRef.current = frameRef.current;
          setGameState(prev => ({ ...prev, level: nextLevel }));
          emitParticles(canvas.width / 2, canvas.height / 2, theme, 50, 5); // Level up burst
          shakeRef.current = 10;
        }

        // Physics
        playerRef.current.y += (playerRef.current.targetY - playerRef.current.y) * 0.25; // Smoother and faster lock-on

        // Trail Exhaust Particles
        if (frameRef.current % 3 === 0) {
           particlesRef.current.push({
             x: 20, 
             y: playerRef.current.y,
             vx: -baseSpeed * 0.5,
             vy: (Math.random() - 0.5) * 2,
             life: 1.0,
             color: gameStateRef.current.isInvincible ? '#00F3FF' : theme,
             size: Math.random() * 3
           });
        }

        // Entity Spawning
        const spawnRateMap = { easy: 1.5, medium: 1, hard: 0.6 };
        const baseSpawnRate = 60 - (gameStateRef.current.level * 5);
        const spawnRate = Math.max(10, baseSpawnRate * spawnRateMap[gameStateRef.current.difficulty]);
        
        if (frameRef.current % Math.floor(spawnRate) === 0) {
          spawnEntity();
        }

        for (let i = obstaclesRef.current.length - 1; i >= 0; i--) {
          const obs = obstaclesRef.current[i];
          obs.x -= baseSpeed;

          if (obs.type === 'shark') {
            obs.y += Math.sin(frameRef.current * 0.05) * 5;
          }

          // Collision check
          const px = 50;
          const py = playerRef.current.y;
          const pw = playerRef.current.width;
          const ph = playerRef.current.height;

          let removed = false;

          if (
            px < obs.x + obs.w &&
            px + pw > obs.x &&
            py - ph/2 < obs.y + obs.h/2 &&
            py + ph/2 > obs.y - obs.h/2
          ) {
            if (obs.type === 'coin') {
              emitParticles(obs.x + obs.w/2, obs.y, '#FFD700', 20, 4);
              shakeRef.current = 5;
              setGameState(prev => {
                const newCoins = prev.coins + 1;
                if (newCoins >= 5) {
                    return { ...prev, coins: 0, status: 'powerupChoice' };
                }
                return { ...prev, coins: newCoins };
              });
              obstaclesRef.current.splice(i, 1);
              removed = true;
            } else if (obs.type === 'rift') {
              emitParticles(px, py, '#ffffff', 30, 5);
              playerRef.current.y = playerRef.current.y < canvas.height / 2 ? canvas.height - 50 : 50;
              playerRef.current.targetY = playerRef.current.y;
              shakeRef.current = 8;
              obstaclesRef.current.splice(i, 1);
              removed = true;
            } else {
              if (!gameStateRef.current.isInvincible) {
                emitParticles(px, py, '#ff0000', 50, 6); // Death explosion
                shakeRef.current = 20;
                setGameState(prev => ({
                  ...prev,
                  status: 'gameover',
                  highscore: Math.max(prev.highscore, Math.floor(prev.score))
                }));
              }
            }
          }

          if (!removed && obs.x < -150) {
            obstaclesRef.current.splice(i, 1);
            removed = true;
          }

          if (!removed) {
            drawEntity(obs);
          }
        }

        setGameState(prev => ({ ...prev, score: prev.score + (0.1 * prev.level * prev.scoreMultiplier) }));
      }

      // Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.02;
          
          if (p.life <= 0) {
             particlesRef.current.splice(i, 1);
             continue;
          }

          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0, p.size * p.life), 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;

      drawPlayer(playerRef.current, theme);
      ctx.restore(); // Restore after draw (removes shake offset for HUD etc)

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('touchmove', handleGlobalMove);
      if (neuralTimerRef.current) clearTimeout(neuralTimerRef.current);
      resizeObserver.disconnect();
    };
  }, []);

  const startGame = () => {
    obstaclesRef.current = [];
    particlesRef.current = [];
    shakeRef.current = 0;
    setGameState({ 
      ...gameState, 
      score: 0, 
      status: 'playing', 
      coins: 0, 
      level: 1, 
      isNeuralLinked: false,
      isInvincible: false,
      scoreMultiplier: 1,
    });
    frameRef.current = 0;
    levelStartFrameRef.current = 0;
    if (powerupTimerRef.current) clearTimeout(powerupTimerRef.current);
  };

  const handlePowerupChoice = (choice: 'undie' | 'booster') => {
    if (powerupTimerRef.current) clearTimeout(powerupTimerRef.current);

    if (choice === 'undie') {
      setGameState(prev => ({ ...prev, isInvincible: true, status: 'playing' }));
    } else {
      setGameState(prev => ({ ...prev, scoreMultiplier: 2, status: 'playing' }));
    }

    powerupTimerRef.current = setTimeout(() => {
      setGameState(prev => ({ ...prev, isInvincible: false, scoreMultiplier: 1 }));
    }, 15000);
  };

  const setDifficulty = (diff: Difficulty) => {
    setGameState(prev => ({ ...prev, difficulty: diff }));
  };

  useEffect(() => {
    if (gameState.status === 'gameover') {
      localStorage.setItem('gator-highscore', gameState.highscore.toString());
      if (powerupTimerRef.current) clearTimeout(powerupTimerRef.current);
    }
  }, [gameState.status, gameState.highscore]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-[#020202] rounded-lg overflow-hidden border-2 shadow-[0_0_50px_rgba(57,255,20,0.15)] flex flex-col transition-all duration-500 ${gameState.isNeuralLinked ? 'neural-chromatic' : ''}`}
      style={{ borderColor: getThemeColor(gameState.level) }}
    >
      {/* CRT Overlay */}
      <div className="absolute inset-0 crt-overlay pointer-events-none" />

      {/* SVG filter for chromatic aberration */}
      <svg className="hidden">
        <filter id="chromatic-aberration">
          <feOffset in="SourceGraphic" dx="-4" dy="0" result="red" />
          <feOffset in="SourceGraphic" dx="4" dy="0" result="blue" />
          <feColorMatrix in="red" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="redOut" />
          <feColorMatrix in="blue" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="blueOut" />
          <feBlend in="redOut" in2="blueOut" mode="screen" result="blend" />
          <feBlend in="blend" in2="SourceGraphic" mode="screen" />
        </filter>
      </svg>

      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between z-10 pointer-events-none font-mono">
        <div className="flex gap-4">
            <div className="bg-black/80 px-4 py-2 border border-[#39FF14] rounded">
              <span className="text-[10px] text-[#39FF14] block uppercase tracking-widest">Score</span>
              <span className="text-xl text-white tabular-nums">
                {Math.floor(gameState.score).toString().padStart(6, '0')}
              </span>
            </div>
            <div className="bg-black/80 px-4 py-2 border border-[#FFD700] rounded">
              <span className="text-[10px] text-[#FFD700] block uppercase tracking-widest">Cells</span>
              <span className="text-xl text-white tabular-nums flex items-center gap-1">
                {gameState.coins}/5
              </span>
            </div>
        </div>

        <div className="flex gap-4">
            <div className="bg-black/80 px-4 py-2 border border-white/20 rounded">
              <span className="text-[10px] text-gray-500 block uppercase tracking-widest">Lv.</span>
              <span className="text-xl text-white tabular-nums">
                {gameState.level}
              </span>
            </div>
            <div className="bg-black/80 px-4 py-2 border border-[#00F3FF] rounded">
              <span className="text-[10px] text-[#00F3FF] block uppercase tracking-widest">Best</span>
              <span className="text-xl text-white/80 tabular-nums">
                {Math.floor(gameState.highscore).toString().padStart(6, '0')}
              </span>
            </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-none touch-none"
      />

      {/* Neural Link Progress Bar */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-48 h-1 bg-white/5 rounded-full overflow-hidden z-10">
        <motion.div 
            className="h-full bg-[#FFD700] shadow-[0_0_10px_#FFD700]"
            initial={{ width: 0 }}
            animate={{ width: `${(gameState.coins / 5) * 100}%` }}
        />
      </div>

      {/* Control Hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 uppercase tracking-widest bg-black/40 px-4 py-1 rounded-full z-10 pointer-events-none">
        Move cursor to swim · Avoid obstacles
      </div>

      {/* States */}
      <AnimatePresence>
        {gameState.status === 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#050505]/90 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-20"
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                filter: ["drop-shadow(0 0 10px #39FF14)", "drop-shadow(0 0 20px #39FF14)", "drop-shadow(0 0 10px #39FF14)"]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-6xl font-black text-white uppercase italic mb-4 tracking-tighter"
            >
              GATOR<span className="text-[#39FF14]">PULSE</span>
            </motion.div>
            <p className="text-gray-500 text-xs uppercase tracking-[0.2em] mb-4 max-w-sm">
              Collect 5 Golden Data Fragments to choose a powerup.
            </p>
            
            <div className="flex gap-4 mb-8">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(diff => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  className={`px-4 py-1 text-[10px] uppercase tracking-widest rounded border transition-colors ${gameState.difficulty === diff ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10' : 'border-gray-700 text-gray-500 hover:text-white'}`}
                >
                  {diff}
                </button>
              ))}
            </div>

            <button
              onClick={startGame}
              className="group relative px-8 py-3 bg-[#39FF14] text-black font-bold text-xs uppercase tracking-widest overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(57,255,20,0.3)]"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
              <span className="relative flex items-center gap-2">
                <Play className="w-5 h-5 fill-current" />
                Connect Interface
              </span>
            </button>
          </motion.div>
        )}

        {gameState.status === 'gameover' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 bg-[#050505]/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-20"
          >
            <div className="text-[#FF00E5] text-[10px] font-mono uppercase tracking-[0.3em] mb-2 font-bold">Link Severed</div>
            <div className="text-6xl font-black text-white italic mb-2 tracking-tighter">DATA LOSS</div>
            <div className="text-sm font-mono text-[#39FF14] mb-4">
              {getRizzMessage(gameState.score)}
            </div>
            <div className="text-xl font-mono text-gray-500 mb-6 flex items-center gap-2">
              Score: <span className="text-white">{Math.floor(gameState.score)}</span> | Lv: <span className="text-[#39FF14]">{gameState.level}</span>
            </div>

            <div className="flex gap-4 mb-8">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map(diff => (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  className={`px-4 py-1 text-[10px] uppercase tracking-widest rounded border transition-colors ${gameState.difficulty === diff ? 'border-[#39FF14] text-[#39FF14] bg-[#39FF14]/10' : 'border-gray-700 text-gray-500 hover:text-white'}`}
                >
                  {diff}
                </button>
              ))}
            </div>

            <button
              onClick={startGame}
              className="group relative px-8 py-3 bg-[#FF00E5] text-white font-bold text-xs uppercase tracking-widest overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(244,63,94,0.3)]"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
              <span className="relative flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                Reconnect Neural Link
              </span>
            </button>
          </motion.div>
        )}

        {gameState.status === 'powerupChoice' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 bg-[#050505]/80 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center z-30"
          >
            <div className="text-[#FFD700] text-[10px] font-mono uppercase tracking-[0.3em] mb-4 font-bold animate-pulse">
              System Override Ready
            </div>
            <div className="text-4xl font-black text-white italic mb-8 tracking-tighter">
              CHOOSE UPGRADE
            </div>
            
            <div className="flex gap-6">
              <button
                onClick={() => handlePowerupChoice('undie')}
                className="group flex flex-col items-center gap-4 p-6 bg-black border border-[#00F3FF] rounded transition-all hover:bg-[#00F3FF]/10 hover:scale-105 shadow-[0_0_15px_rgba(0,243,255,0.2)]"
              >
                <div className="w-16 h-16 rounded-full border-2 border-[#00F3FF] shadow-[0_0_15px_#00F3FF] flex items-center justify-center">
                  <Trophy className="w-8 h-8 text-[#00F3FF]" />
                </div>
                <div>
                  <div className="text-[#00F3FF] font-bold uppercase tracking-widest text-sm mb-1">Undie Tool</div>
                  <div className="text-[10px] text-gray-400 font-mono">Invincibility for 15s</div>
                </div>
              </button>

              <button
                onClick={() => handlePowerupChoice('booster')}
                className="group flex flex-col items-center gap-4 p-6 bg-black border border-[#39FF14] rounded transition-all hover:bg-[#39FF14]/10 hover:scale-105 shadow-[0_0_15px_rgba(57,255,20,0.2)]"
              >
                <div className="w-16 h-16 rounded-full border-2 border-[#39FF14] shadow-[0_0_15px_#39FF14] flex items-center justify-center">
                  <Zap className="w-8 h-8 text-[#39FF14]" />
                </div>
                <div>
                  <div className="text-[#39FF14] font-bold uppercase tracking-widest text-sm mb-1">Score Booster</div>
                  <div className="text-[10px] text-gray-400 font-mono">2x Multiplier for 15s</div>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
