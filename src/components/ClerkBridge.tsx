import React, { useEffect } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import {
  syncUserProfileToSupabase,
  type AppUserProfile,
} from '../lib/supabaseClient';

interface ClerkBridgeProps {
  onUserChange: (user: AppUserProfile | null) => void;
  onRegisterSignOut: (fn: () => Promise<void>) => void;
}

export const ClerkBridge: React.FC<ClerkBridgeProps> = ({
  onUserChange,
  onRegisterSignOut,
}) => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    onRegisterSignOut(async () => {
      try {
        await signOut();
      } catch {
        // ignore
      }
    });
  }, [signOut, onRegisterSignOut]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && user) {
      const profile: AppUserProfile = {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? '',
        fullName:
          user.username ||
          user.firstName ||
          user.fullName ||
          user.primaryEmailAddress?.emailAddress?.split('@')[0] ||
          'author',
        avatarUrl: user.imageUrl,
        provider: 'clerk',
      };
      syncUserProfileToSupabase(profile).catch(() => {});
      onUserChange(profile);
    }
  }, [isLoaded, isSignedIn, user, onUserChange]);

  return null;
};
