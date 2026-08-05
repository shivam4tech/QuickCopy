export interface LanguageEntry {
  code: string;
  name: string;
  size: string;
}

export interface InstalledLanguage {
  code: string;
  installedAt: number;
  size: number;
}

export const TESSDATA_BASE_URL = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/';

export const LANGUAGES: LanguageEntry[] = [
  { code: 'deu', name: 'German', size: '1.5 MB' },
  { code: 'fra', name: 'French', size: '1.1 MB' },
  { code: 'spa', name: 'Spanish', size: '6.7 MB' },
  { code: 'hin', name: 'Hindi', size: '1.1 MB' },
  { code: 'jpn', name: 'Japanese', size: '7.9 MB' },
  { code: 'chi_sim', name: 'Chinese (Simplified)', size: '2.5 MB' },
  { code: 'chi_tra', name: 'Chinese (Traditional)', size: '2.4 MB' },
  { code: 'por', name: 'Portuguese', size: '6.1 MB' },
  { code: 'ita', name: 'Italian', size: '5.2 MB' },
  { code: 'nld', name: 'Dutch', size: '4.5 MB' },
  { code: 'rus', name: 'Russian', size: '5.5 MB' },
  { code: 'ara', name: 'Arabic', size: '1.4 MB' },
  { code: 'kor', name: 'Korean', size: '6.2 MB' },
  { code: 'tur', name: 'Turkish', size: '1.5 MB' },
  { code: 'pol', name: 'Polish', size: '1.6 MB' },
  { code: 'ukr', name: 'Ukrainian', size: '1.9 MB' },
  { code: 'vie', name: 'Vietnamese', size: '1.8 MB' },
  { code: 'ind', name: 'Indonesian', size: '1.5 MB' },
  { code: 'tha', name: 'Thai', size: '1.9 MB' },
  { code: 'fas', name: 'Persian', size: '0.4 MB' },
  { code: 'ron', name: 'Romanian', size: '1.2 MB' },
  { code: 'ell', name: 'Greek', size: '1.4 MB' },
  { code: 'ces', name: 'Czech', size: '3.8 MB' },
  { code: 'hun', name: 'Hungarian', size: '2.8 MB' },
  { code: 'swe', name: 'Swedish', size: '1.9 MB' },
  { code: 'nor', name: 'Norwegian', size: '1.2 MB' },
  { code: 'dan', name: 'Danish', size: '2.6 MB' },
  { code: 'fin', name: 'Finnish', size: '7.9 MB' },
  { code: 'heb', name: 'Hebrew', size: '1.0 MB' },
  { code: 'msa', name: 'Malay', size: '0.9 MB' },
  { code: 'tam', name: 'Tamil', size: '1.4 MB' },
  { code: 'tel', name: 'Telugu', size: '1.5 MB' },
  { code: 'mar', name: 'Marathi', size: '1.3 MB' },
  { code: 'ben', name: 'Bengali', size: '0.9 MB' },
  { code: 'pan', name: 'Punjabi', size: '1.5 MB' },
  { code: 'urd', name: 'Urdu', size: '1.3 MB' },
  { code: 'guj', name: 'Gujarati', size: '1.4 MB' },
  { code: 'kan', name: 'Kannada', size: '1.5 MB' },
  { code: 'mal', name: 'Malayalam', size: '1.6 MB' },
  { code: 'ceb', name: 'Cebuano', size: '0.7 MB' },
  { code: 'lav', name: 'Latvian', size: '4.2 MB' },
  { code: 'lit', name: 'Lithuanian', size: '4.7 MB' },
  { code: 'slv', name: 'Slovenian', size: '4.2 MB' },
  { code: 'hrv', name: 'Croatian', size: '4.1 MB' },
  { code: 'srp', name: 'Serbian', size: '1.5 MB' },
  { code: 'sqi', name: 'Albanian', size: '1.2 MB' },
  { code: 'slk', name: 'Slovak', size: '1.5 MB' },
  { code: 'bul', name: 'Bulgarian', size: '1.7 MB' },
  { code: 'est', name: 'Estonian', size: '4.5 MB' },
  { code: 'cat', name: 'Catalan', size: '1.1 MB' },
  { code: 'fil', name: 'Filipino', size: '1.8 MB' },
];

export const LANGUAGE_MAP: Record<string, LanguageEntry> = {};
for (const lang of LANGUAGES) {
  LANGUAGE_MAP[lang.code] = lang;
}

export function getLanguageByCode(code: string): LanguageEntry | undefined {
  return LANGUAGE_MAP[code];
}

export function isLanguageAvailable(code: string): boolean {
  return code in LANGUAGE_MAP;
}
