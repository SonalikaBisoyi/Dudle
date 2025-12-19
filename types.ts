
export interface DoodleStyle {
  thickness: 'Fine' | 'Medium' | 'Bold';
  color: string;
  artStyle: 'Minimalist' | 'Crayon' | 'Felt Tip' | 'Charcoal' | 'Abstract';
}

export interface DoodleEntry {
  id: string;
  date: string;
  transcript: string;
  imageUrl: string;
  prompt: string;
  style: DoodleStyle;
}

export interface VoiceState {
  isActive: boolean;
  transcript: string;
  error: string | null;
}
