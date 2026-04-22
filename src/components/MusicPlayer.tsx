import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ListMusic,
  Heart,
  Repeat,
  Shuffle,
  Music
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Song } from '../types';
import { DUMMY_SONGS } from '../constants';
import SongUploader from './SongUploader';
import AlligatorGame from './AlligatorGame';

interface MusicPlayerProps {
  layout?: 'default' | 'immersive';
  onIntensityChange?: (intensity: number) => void;
  isNeuralLinked?: boolean;
  onNeuralLinkStateChange?: (linked: boolean) => void;
  intensity?: number;
}

export default function MusicPlayer({ 
  layout = 'default', 
  onIntensityChange, 
  isNeuralLinked = false, 
  onNeuralLinkStateChange,
  intensity = 0 
}: MusicPlayerProps) {
  const [songs, setSongs] = useState<Song[]>(DUMMY_SONGS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const currentSong = songs[currentIndex];

  useEffect(() => {
    if (!audioRef.current || analyserRef.current) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaElementSource(audioRef.current);
    const analyser = audioContext.createAnalyser();
    const filter = audioContext.createBiquadFilter();
    
    analyser.fftSize = 256;
    filter.type = 'lowpass';
    filter.frequency.value = 20000;

    source.connect(filter);
    filter.connect(analyser);
    analyser.connect(audioContext.destination);

    analyserRef.current = analyser;
    filterRef.current = filter;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateIntensity = () => {
      if (analyserRef.current && isPlaying) {
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;
        const normalized = average / 255;
        (window as any).NEO_INTENSITY = normalized;
        onIntensityChange?.(normalized);
      } else {
        (window as any).NEO_INTENSITY = 0;
        onIntensityChange?.(0);
      }
      requestAnimationFrame(updateIntensity);
    };

    updateIntensity();

    return () => {
      audioContext.close();
    };
  }, [isPlaying, onIntensityChange]);

  useEffect(() => {
    if (audioRef.current && filterRef.current) {
      if (isNeuralLinked) {
        audioRef.current.playbackRate = 0.7; // Slowed
        filterRef.current.frequency.setTargetAtTime(800, 0, 0.1); // Muffled/Reverb-ish
      } else {
        audioRef.current.playbackRate = 1.0;
        filterRef.current.frequency.setTargetAtTime(20000, 0, 0.1);
      }
    }
  }, [isNeuralLinked]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentIndex]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleEnded = () => {
    skipForward();
  };

  const skipForward = () => {
    setCurrentIndex((prev) => (prev + 1) % songs.length);
    setIsPlaying(true);
  };

  const skipBackward = () => {
    setCurrentIndex((prev) => (prev - 1 + songs.length) % songs.length);
    setIsPlaying(true);
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const addSong = (song: Song) => {
    setSongs(prev => [...prev, song]);
    setCurrentIndex(songs.length); // Play the new song
    setIsPlaying(true);
  };

  if (layout === 'immersive') {
    return (
      <>
        <audio
          ref={audioRef}
          src={currentSong.url}
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden max-h-[100dvh]">
          {/* Main Area: Alligator Game (Top on mobile, center on desktop) */}
          <section className="flex-[2] md:flex-1 relative bg-[#020202] flex items-center justify-center p-2 md:p-8 order-1 md:order-2">
            <div className="w-full h-full max-w-4xl relative">
              <AlligatorGame 
                onNeuralLinkTrigger={(active) => onNeuralLinkStateChange?.(active)}
              />
            </div>
          </section>

          {/* Left Sidebar: Music Library (Bottom on mobile, Left on desktop) */}
          <aside className="w-full md:w-64 bg-[#080808] border-t md:border-t-0 md:border-r border-gray-800 flex flex-col overflow-hidden order-2 md:order-1 flex-1 md:flex-none">
            <div className="p-4 md:p-6 flex-1 overflow-y-auto custom-scrollbar min-h-0">
              <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-4 md:mb-6">Current Queue</h2>
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {songs.map((song, index) => (
                    <motion.div
                      key={song.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onClick={() => {
                        setCurrentIndex(index);
                        setIsPlaying(true);
                      }}
                      className={`group cursor-pointer flex items-center gap-3 p-3 rounded transition-all ${index === currentIndex ? 'bg-[#111] border border-[#39FF14]/30 shadow-[0_0_10px_rgba(57,255,20,0.1)]' : 'hover:bg-[#111] border border-transparent'}`}
                    >
                      <div className="w-10 h-10 bg-gray-900 rounded flex items-center justify-center overflow-hidden flex-shrink-0">
                        {index === currentIndex && isPlaying ? (
                           <div className="flex gap-0.5 items-end h-3">
                             <div className="w-0.5 bg-[#39FF14] animate-[music-bar_0.6s_ease-in-out_infinite]" />
                             <div className="w-0.5 bg-[#39FF14] animate-[music-bar_0.8s_ease-in-out_infinite_0.1s]" />
                             <div className="w-0.5 bg-[#39FF14] animate-[music-bar_0.5s_ease-in-out_infinite_0.2s]" />
                           </div>
                        ) : (
                          <Music className="w-4 h-4 text-gray-700" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-[11px] font-bold truncate ${index === currentIndex ? 'text-white' : 'text-gray-400'}`}>
                          {song.title}
                        </span>
                        <span className="text-[10px] text-gray-600 truncate">{song.artist}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
            <div className="p-4 md:p-6 border-t border-gray-800">
              <SongUploader onUpload={addSong} />
            </div>
          </aside>

          {/* Right Sidebar: Visualizer / Metadata (Hidden on mobile) */}
          <aside className="hidden lg:flex w-48 bg-[#080808] border-l border-gray-800 p-6 flex-col gap-8 order-3">
            <div>
              <h2 className="text-[10px] uppercase tracking-widest text-gray-500 mb-4">Frequency</h2>
              <div className="flex items-end gap-1 h-24">
                {[0.4, 0.7, 0.9, 0.5, 0.8, 0.3, 0.6, 0.85].map((factor, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: `${Math.max(10, (intensity * 100 * factor) + (Math.sin(Date.now() * 0.01 + i) * 10))}%` 
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className={`w-full bg-[#00F3FF] shadow-[0_0_10px_#00F3FF]`}
                    style={{ opacity: factor }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <h2 className="text-[10px] uppercase tracking-widest text-gray-500">Track Detail</h2>
              <div className="text-[10px] space-y-2 uppercase font-mono tracking-wider">
                <div className="flex justify-between"><span className="text-gray-600">Codec:</span> <span className="text-white">MP3-320</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Sample:</span> <span className="text-white">44.1KHZ</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Tempo:</span> <span className="text-[#39FF14]">VARYING</span></div>
              </div>
            </div>
          </aside>
        </main>

        {/* Player Controls Bar */}
        <footer className="h-auto md:h-24 py-4 md:py-0 bg-[#0a0a0a] border-t border-gray-800 flex flex-col md:flex-row items-center justify-between px-4 md:px-8 gap-4 md:gap-8 z-20 flex-shrink-0">
          <div className="flex items-center gap-4 w-full md:w-64 flex-shrink-0 justify-between md:justify-start">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#111] rounded border border-gray-800 flex items-center justify-center overflow-hidden">
                <img src={currentSong.cover} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{currentSong.title}</p>
                <p className="text-[10px] text-gray-500 truncate">{currentSong.artist}</p>
              </div>
            </div>
            
            {/* Mobile Play Button Override */}
            <div className="md:hidden">
                <button 
                  onClick={togglePlay}
                  className="w-10 h-10 bg-[#39FF14] rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-transform active:scale-90"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>
            </div>
          </div>

          <div className="flex-1 flex w-full md:w-auto flex-col items-center gap-3">
            <div className="hidden md:flex items-center gap-6">
              <button 
                onClick={skipBackward}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button 
                onClick={togglePlay}
                className="w-10 h-10 bg-[#39FF14] rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(57,255,20,0.4)] transition-transform active:scale-90"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>
              <button 
                onClick={skipForward}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
            <div className="w-full max-w-md flex items-center gap-3">
              <span className="text-[10px] font-mono text-gray-500 w-10 text-right">{formatTime(currentTime)}</span>
              <div className="flex-1 h-1 bg-gray-800 rounded-full relative group cursor-pointer">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSliderChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div 
                  className="absolute left-0 top-0 h-full bg-[#39FF14] shadow-[0_0_8px_#39FF14] rounded-full" 
                  style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0-10px-white] border border-gray-300"
                  style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-gray-500 w-10">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="hidden md:flex w-64 justify-end items-center gap-4 flex-shrink-0">
             <Volume2 className="w-4 h-4 text-gray-500" />
             <div className="w-24 h-1 bg-gray-800 rounded-full relative group cursor-pointer">
               <input
                 type="range"
                 min="0"
                 max="1"
                 step="0.01"
                 value={volume}
                 onChange={handleVolumeChange}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
               />
               <div className="h-full bg-[#00F3FF] rounded-full" style={{ width: `${volume * 100}%` }}></div>
             </div>
          </div>
        </footer>
      </>
    );
  }

  // Original Default Layout
  return (
    <div className="flex flex-col h-full text-white overflow-hidden bg-slate-950/40 backdrop-blur-xl border-l border-white/5">
      <audio
        ref={audioRef}
        src={currentSong.url}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      {/* Header */}
      <div className="p-6 border-bottom border-white/5">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
              <ListMusic className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-bold tracking-tight text-lg">NEO PLAYER</span>
          </div>
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            className={`p-2 rounded-lg transition-colors ${showPlaylist ? 'bg-cyan-500 text-slate-900' : 'hover:bg-white/5 text-white/60'}`}
          >
            <ListMusic className="w-5 h-5" />
          </button>
        </div>

        {/* Album Art & Track Info */}
        <div className="relative aspect-square rounded-2xl overflow-hidden mb-6 shadow-2xl group">
          <motion.img
            key={currentSong.id}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            src={currentSong.cover}
            alt={currentSong.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="text-xl font-bold truncate drop-shadow-lg">{currentSong.title}</h2>
            <p className="text-white/60 text-sm truncate">{currentSong.artist}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSliderChange}
              className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
            <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase tracking-widest">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button className="text-white/40 hover:text-white transition-colors">
              <Shuffle className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-6">
              <button
                onClick={skipBackward}
                className="text-white/60 hover:text-white transition-all transform active:scale-90"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>
              <button
                onClick={togglePlay}
                className="w-12 h-12 bg-white text-slate-950 rounded-full flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-1" />
                )}
              </button>
              <button
                onClick={skipForward}
                className="text-white/60 hover:text-white transition-all transform active:scale-90"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>
            </div>
            <button className="text-white/40 hover:text-white transition-colors">
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
            <button
               onClick={() => setIsMuted(!isMuted)}
               className="text-white/40 hover:text-white"
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white"
            />
          </div>
        </div>
      </div>

      {/* Playlist / Upload */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
        <div className="space-y-6">
          <SongUploader onUpload={addSong} />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-white/40 uppercase tracking-widest mb-4">
              <span>Next Tracks</span>
              <span>{songs.length} Items</span>
            </div>
            <AnimatePresence mode="popLayout">
              {songs.map((song, index) => (
                <motion.button
                  key={song.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    setCurrentIndex(index);
                    setIsPlaying(true);
                  }}
                  className={`w-full group flex items-center gap-3 p-2 rounded-xl transition-all ${index === currentIndex ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={song.cover} alt="" className="w-full h-full object-cover" />
                    {index === currentIndex && isPlaying && (
                      <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                        <div className="flex gap-0.5 items-end h-3">
                          <div className="w-0.5 bg-cyan-400 animate-[music-bar_0.6s_ease-in-out_infinite]" />
                          <div className="w-0.5 bg-cyan-400 animate-[music-bar_0.8s_ease-in-out_infinite_0.1s]" />
                          <div className="w-0.5 bg-cyan-400 animate-[music-bar_0.5s_ease-in-out_infinite_0.2s]" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className={`text-sm font-bold truncate ${index === currentIndex ? 'text-cyan-400' : 'text-white'}`}>
                      {song.title}
                    </div>
                    <div className="text-xs text-white/40 truncate">{song.artist}</div>
                  </div>
                  <button className="p-2 text-white/20 hover:text-pink-500 transition-colors opacity-0 group-hover:opacity-100">
                    <Heart className="w-4 h-4" />
                  </button>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
