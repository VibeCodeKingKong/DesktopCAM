/** Alla ordlistor. Egen modul utan beroende till store, så att den kan användas när store skapas. */
import type { Language } from './initial';
import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { pl } from './pl';
import { sv, type Dict } from './sv';
import { uk } from './uk';

export const DICTS: Record<Language, Dict> = { sv, en, fr, de, es, pl, uk };
