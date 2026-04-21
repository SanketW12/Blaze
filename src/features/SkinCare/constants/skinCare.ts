import type { SkinCareRoutineTemplate } from '../types/skinCare';

export const DEFAULT_SKINCARE_USER_ID = 'sanket';
export const SKIN_CARE_COLLECTION = 'skin_daily_logs';

export const SKIN_CARE_ROUTINES: SkinCareRoutineTemplate[] = [
  {
    key: 'morning',
    label: 'Morning Routine',
    steps: [
      {
        id: 'morning-face-wash',
        label: 'Face Wash',
        how: 'Wet face, take cleanser in hands, massage gently in circular motion for 20-30 sec, rinse and pat dry.',
        quantity: 'Coin-sized',
        use: 'Cleans dirt and oil so other products work properly.'
      },
      {
        id: 'morning-vitamin-c',
        label: 'Vitamin C Serum',
        how: 'Take on fingertips, dot on face, and spread gently across face.',
        quantity: '2-3 drops',
        use: 'Brightens skin, reduces tan, and protects from sun damage.'
      },
      {
        id: 'morning-niacinamide',
        label: 'Niacinamide Serum',
        optional: true,
        how: 'Take on fingertips, dot on face, and spread evenly and gently.',
        quantity: '2-3 drops',
        use: 'Evens skin tone, controls oil, and supports pigmentation treatment.'
      },
      {
        id: 'morning-moisturizer',
        label: 'Moisturizer',
        how: 'Take on fingertips, dot on face, spread evenly, and massage lightly.',
        quantity: 'Pea to coin-sized',
        use: 'Hydrates skin and protects barrier.'
      },
      {
        id: 'morning-sunscreen',
        label: 'Sunscreen',
        how: 'Apply on fingers, spread across face and neck evenly, and ensure full coverage.',
        quantity: '2 finger lengths',
        use: 'Prevents tanning and pigmentation.'
      }
    ]
  },
  {
    key: 'night',
    label: 'Night Routine',
    steps: [
      {
        id: 'night-face-wash',
        label: 'Face Wash',
        how: 'Wet face, take cleanser, massage gently for 20-30 sec, rinse and pat dry.',
        quantity: 'Coin-sized',
        use: 'Removes dirt and sunscreen.'
      },
      {
        id: 'night-niacinamide',
        label: 'Niacinamide Serum',
        optional: true,
        how: 'Take on fingertips, dot on face, and spread evenly.',
        quantity: '2-3 drops',
        use: 'Supports skin repair and reduces pigmentation.'
      },
      {
        id: 'night-retinol-aha',
        label: 'Retinol Serum (OR AHA Serum)',
        how: 'Retinol: take a small amount on fingertips, dot lightly on face, spread a thin layer, avoid eye area. AHA: take a small amount on fingertips or cotton pad, apply evenly on face, avoid eyes, and do not use with retinol on the same night.',
        quantity: 'Retinol: pea-sized OR AHA: thin layer',
        use: 'Retinol improves skin turnover and reduces pigmentation; AHA removes dead skin and helps reduce tan.'
      },
      {
        id: 'night-moisturizer',
        label: 'Moisturizer',
        how: 'Take on fingertips, dot on face, spread evenly, and gently massage.',
        quantity: 'Pea to coin-sized',
        use: 'Hydrates and helps prevent irritation from actives.'
      }
    ]
  }
];
