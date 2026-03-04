import { useMemo } from 'react';
import type { AppStoreState } from '@/store/useAppStore';

export const useProfileContext = ({
  includeMyInfo,
  userProfile
}: {
  includeMyInfo: boolean;
  userProfile: AppStoreState['userProfile'];
}) =>
  useMemo(() => {
    if (!includeMyInfo || !userProfile) return undefined;
    const {
      required_nutrients: _requiredNutrients,
      must_complete_keys: _mustCompleteKeys,
      ...safeProfileContext
    } = userProfile;
    return `MY PROFILE INFO (for personalization):
${JSON.stringify(safeProfileContext, null, 2)}`;
  }, [includeMyInfo, userProfile]);
