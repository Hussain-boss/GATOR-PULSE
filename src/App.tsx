/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import MusicPlayer from './components/MusicPlayer';
import AlligatorGame from './components/AlligatorGame';
import { Gamepad2, Skull, Zap } from 'lucide-react';

export default function App() {
  const [gameIntensity, setGameIntensity] = React.useState(0);
  const [isNeuralLinked, setIsNeuralLinked] = React.useState(false);

  return (
    <div className={`fixed inset-0 w-[100dvw] h-[100dvh] bg-[#050505] text-gray-300 font-sans flex flex-col overflow-hidden transition-all duration-1000 ${isNeuralLinked ? 'grayscale-50' : ''}`}>
      {/* Header / Navigation */}
      <header className="h-16 border-b border-gray-800 bg-[#0a0a0a] flex items-center justify-between px-6 shadow-[0_0_15px_rgba(0,243,255,0.1)] z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#39FF14] rounded-sm flex items-center justify-center shadow-[0_0_10px_#39FF14]">
            <span className="text-black font-bold">G</span>
          </div>
          <h1 className="text-xl font-black tracking-tighter text-white">
            GATOR<span className="text-[#39FF14]">PULSE</span>
          </h1>
        </div>
        <div className="hidden md:flex gap-8 text-[10px] font-medium uppercase tracking-widest">
          <span className="text-[#00F3FF] cursor-default border-b border-[#00F3FF] pb-1 font-mono">Intensity: {Math.floor(gameIntensity * 100)}%</span>
          <span className={`transition-all duration-300 ${isNeuralLinked ? 'text-[#FF00E5] shadow-[0_0_10px_#FF00E5]' : 'text-gray-500'}`}>Neural Link: {isNeuralLinked ? 'ACTIVE' : 'IDLE'}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[8px] text-gray-500 uppercase tracking-widest leading-none mb-1">System Status</span>
            <span className={`text-[10px] font-mono animate-pulse ${isNeuralLinked ? 'text-[#FF00E5]' : 'text-[#39FF14]'}`}>
              {isNeuralLinked ? 'OVERDRIVE [SLOW-MO]' : 'ONLINE [READY]'}
            </span>
          </div>
        </div>
      </header>

      <MusicPlayer 
        layout="immersive" 
        onIntensityChange={setGameIntensity}
        isNeuralLinked={isNeuralLinked}
        onNeuralLinkStateChange={setIsNeuralLinked}
        intensity={gameIntensity}
      />
    </div>
  );
}
