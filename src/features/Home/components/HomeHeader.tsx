import { useMemo } from 'react';
import { DashboardHeader } from '@/features/Dashboard/components/dashboard/DashboardHeader';
import { useAppStore } from '@/store';
import { formatProfileValue } from '@/features/Dashboard/utils/formatters';



export const HomeHeader = () => {
  const userProfile = useAppStore(state => state.userProfile);
  const rawProfile = userProfile as unknown as Record<string, unknown> | null;

  const profileInfoRows = useMemo(
    () => [
      { label: 'Name', value: formatProfileValue(rawProfile?.name) },
      { label: 'Age', value: formatProfileValue(rawProfile?.age, ' years') },
      { label: 'Gender', value: formatProfileValue(rawProfile?.gender) },
      {
        label: 'Height',
        value: formatProfileValue(rawProfile?.height_cm ?? rawProfile?.heightCm, ' cm')
      },
      {
        label: 'Weight',
        value: formatProfileValue(rawProfile?.weight_kg ?? rawProfile?.weightKg, ' kg')
      },
      { label: 'Activity Level', value: formatProfileValue(rawProfile?.activity_level ?? rawProfile?.activityLevel) },
      { label: 'BMI', value: formatProfileValue(rawProfile?.bmi) },
      { label: 'BMR', value: formatProfileValue(rawProfile?.bmr, ' kcal/day') }
    ],
    [rawProfile]
  );
  const profileName =
    formatProfileValue(rawProfile?.name) === 'Not set' ? 'NA' : formatProfileValue(rawProfile?.name);

  return (
    <DashboardHeader
      canInstallApp={false}
      onInstallClick={() => { }}
      profileInfoRows={profileInfoRows}
      profileName={profileName}
    />
  );
};
