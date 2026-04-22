import React from 'react';
import { Upload, Plus, Music } from 'lucide-react';
import { Song } from '../types';

interface SongUploaderProps {
  onUpload: (song: Song) => void;
}

export default function SongUploader({ onUpload }: SongUploaderProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const newSong: Song = {
      id: Math.random().toString(36).substr(2, 9),
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Local Upload",
      url,
      cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
    };

    onUpload(newSong);
  };

  return (
    <div className="relative group">
      <input
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      <div className="w-full py-3 border border-dashed border-gray-600 rounded text-[10px] uppercase tracking-tighter text-gray-500 hover:border-[#00F3FF] hover:text-[#00F3FF] transition-all flex items-center justify-center gap-2">
        <Plus className="w-3 h-3" />
        Upload Your Tracks
      </div>
    </div>
  );
}
