// All player-facing text lives in the language files. English is the default.

import en from './en.js';
import uk from './uk.js';

export const LANGUAGES = {
  en: { label: 'English', short: 'EN', dictionary: en },
  uk: { label: 'Українська', short: 'УК', dictionary: uk },
};
export const DEFAULT_LANGUAGE = 'en';

let current = DEFAULT_LANGUAGE;

export const getLanguage = () => current;

/** Falls back to the default for anything unknown, such as a corrupted saved value. */
export function setLanguage(code) {
  current = typeof code === 'string' && Object.hasOwn(LANGUAGES, code) ? code : DEFAULT_LANGUAGE;
}

const dictionary = () => LANGUAGES[current].dictionary;

/** Interface text, with {placeholders} filled in from vars. */
export function t(key, vars = {}) {
  return dictionary().ui[key].replace(/\{(\w+)\}/g, (_, name) => vars[name]);
}

const partText = (part) => (part.screw ? dictionary().screws[part.kind] : dictionary().parts[part.id]);

export const partName = (part) => partText(part).name;
export const partDesc = (part) => partText(part).desc;
export const levelName = (level) => dictionary().levels[level].name;
export const levelNote = (level) => dictionary().levels[level].note;
export const gradeLabel = (stars) => dictionary().grades[stars];
