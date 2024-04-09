export {};

export interface Game {
  id: string;
  clicks: number;
  rounds: number;
  players: Player[];
}

export interface Player {
  id: string;
  playername: string;
  clickTimes: number[];
  score: number | null;
  gameId?: string | null;
}

// extended Player interface with clicktime and points
export interface ExtendedPlayer extends Player {
  clickTime?: number;
  points?: number;
}

export interface Result {
  id: string;
  playerOneHighscore: Number;
  playerTwoHighscore: Number;
  playerOneName: String;
  playerOnePoint: Number;
  playerTwoName: String;
  playerTwoPoint: Number;
  timestamp: Number;
}

export interface Highscore {
  id: string;
  playername: string;
  highscore: number;
}
