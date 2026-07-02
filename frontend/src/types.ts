export type ElementId = 'sender' | 'content' | 'actionUrl' | 'actionText' | 'amount';

export type ClassificationReason =
  | 'Fake Sender/Identity'
  | 'Suspicious Link or URL'
  | 'Urgency or Pressure Tactic'
  | 'Request for Sensitive Information'
  | 'Impersonation or Fake Branding'
  | 'Other';

export type ClassificationStatus = 'SAFE' | 'SUSPICIOUS' | 'NOT_SURE';

export interface ElementData {
  text: string;
  isSuspicious: boolean;
  reason?: ClassificationReason;
  explanation: string;
}

export type StimulusType = 'SMS' | 'WHATSAPP' | 'UPI' | 'EMAIL' | 'SOCIAL';

// Taxonomy the stimulus library must cover (see stimuli.ts).
export type StimulusCategory =
  | 'UPI Payment Requests'
  | 'Bank SMS'
  | 'WhatsApp Messages'
  | 'LinkedIn / Direct Messages'
  | 'Courier / Delivery'
  | 'Tax / Government Notices'
  | 'E-commerce / Orders'
  | 'KYC Updates'
  | 'Insurance'
  | 'Mutual Funds'
  | 'Other / Service';

export interface Stimulus {
  id: string;
  type: StimulusType;
  category?: StimulusCategory; // optional so legacy stimuli can use STIMULUS_CATEGORIES map
  sender: ElementData;
  content: ElementData;
  actionUrl?: ElementData;
  actionText?: ElementData;
  amount?: ElementData;
  difficultyTier: 1 | 2 | 3 | 4 | 5;
  explanation: string; // Used for post-investigation summary
}

export interface InvestigationData {
  status: ClassificationStatus;
  reason?: ClassificationReason;
}

export type GamePhase = 'LOBBY' | 'INTRO' | 'TUTORIAL' | 'PLAYING' | 'INVESTIGATION_REVIEW' | 'INTER_ROUND' | 'COMPUTING' | 'RESULTS';

export interface GameHistoryEntry {
  stimulusId: string;
  investigations: Partial<Record<ElementId, InvestigationData>>;
  scoreChange: number; // proportional score awarded (0-10)
  streakMultiplier: number; // multiplier applied to this stimulus
  isCorrect: boolean; // score >= 8 (80%+) drives the streak
  roundNumber?: number; // which round (1-5) this stimulus was in
  responseTimeMs?: number; // time taken for this stimulus
}

export interface RoundSummary {
  name: string;
  cueVisibility: string;
  teaser: string;
}

export interface GameState {
  phase: GamePhase;
  playerName: string; // entered on the landing screen — shown on the report/share image
  score: number; // live composite score (0-150 max)
  streak: number; // consecutive correct stimuli (drives the streak multiplier)
  currentRound: number;
  currentStimulusIndex: number;
  usedStimuliIds: string[]; // stimuli already shown this run — prevents repeats
  history: GameHistoryEntry[];
  gameStartTime: number | null; // ms timestamp when game started, never reset
  completionTimeMs: number | null; // total time taken to finish the game
}
