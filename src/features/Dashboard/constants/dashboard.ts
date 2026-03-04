import type { LucideIcon } from 'lucide-react';
import { CircleDot, Dna, Droplets, Flame, Pill } from 'lucide-react';

export const CATEGORY_LABELS: Record<string, string> = {
  macronutrient: 'Macronutrients',
  amino_acid: 'Amino Acids',
  fatty_acid: 'Fatty Acids',
  vitamin: 'Vitamins',
  mineral: 'Minerals'
};

export const CATEGORY_COLORS: Record<string, string> = {
  macronutrient: 'var(--chart-1)',
  amino_acid: 'var(--chart-2)',
  fatty_acid: 'var(--chart-3)',
  vitamin: 'var(--chart-4)',
  mineral: 'var(--chart-5)'
};

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  macronutrient: Flame,
  amino_acid: Dna,
  fatty_acid: Droplets,
  vitamin: Pill,
  mineral: CircleDot
};

export const CATEGORY_ORDER = [
  'macronutrient',
  'amino_acid',
  'fatty_acid',
  'vitamin',
  'mineral'
] as const;

export const FALLBACK_MUST_COMPLETE_KEYS = [
  'protein',
  'vitamin_d',
  'magnesium',
  'vitamin_b12',
  'omega3',
  'zinc',
  'potassium',
  'fiber',
  'iron',
  'vitamin_c'
] as const;

export const REMAINING_NUTRIENTS_PLAN_PROMPT =
  'Build this plan only for remaining nutrients not yet completed today. Prioritize must_complete_keys first, then fill all other remaining nutrient gaps.';
