export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover?: string;
  duration?: number;
}

export type GameStatus = "idle" | "playing" | "gameover" | "powerupChoice";
export type Difficulty = "easy" | "medium" | "hard";

export interface GameState {
  score: number;
  status: GameStatus;
  highscore: number;
  coins: number;
  level: number;
  isNeuralLinked: boolean;
  difficulty: Difficulty;
  isInvincible: boolean;
  scoreMultiplier: number;
}
