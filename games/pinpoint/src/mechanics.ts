export interface PinpointGame {
  inputWords: string[];
  correctAnswer: string;
}

export const PINPOINT_GAMES: PinpointGame[] = [
  {
    inputWords: ["Feather", "Lead", "Anchor", "Responsibility", "Dumbbell"],
    correctAnswer: "Weight",
  },
  {
    inputWords: ["Carbon", "Pressure", "Ring", "Baseball", "Rough"],
    correctAnswer: "Diamond",
  },
  {
    inputWords: ["Nile", "Amazon", "Mississippi", "Danube", "Ganges"],
    correctAnswer: "Rivers",
  },
  {
    inputWords: ["Crust", "Mantle", "Core", "Atmosphere", "Lithosphere"],
    correctAnswer: "Earth Layers",
  },
  {
    inputWords: ["Bark", "Ring", "Trunk", "Leaf", "Root"],
    correctAnswer: "Tree",
  },
  {
    inputWords: ["Knight", "Rook", "Pawn", "Bishop", "Queen"],
    correctAnswer: "Chess Pieces",
  },
  {
    inputWords: ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"],
    correctAnswer: "Planets",
  },
  {
    inputWords: ["Cheddar", "Gouda", "Brie", "Mozzarella", "Parmesan"],
    correctAnswer: "Cheese",
  },
  {
    inputWords: ["Violin", "Cello", "Harp", "Guitar", "Banjo"],
    correctAnswer: "String Instruments",
  },
  {
    inputWords: ["Tokyo", "Paris", "London", "Cairo", "Berlin"],
    correctAnswer: "Capital Cities",
  },
];

export function calculateScore(guessCount: number): number {
  switch (guessCount) {
    case 1:
      return 10;
    case 2:
      return 5;
    case 3:
      return 2;
    default:
      return 0;
  }
}
