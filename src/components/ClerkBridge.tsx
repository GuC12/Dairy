import React, { useEffect } from 'react';
import { useClerk, useUser } from '@clerk/react';
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
      const email = user.primaryEmailAddress?.emailAddress ?? '';
      const localSavedName = email
        ? localStorage.getItem('yourdiary_preferred_username_' + email.toLowerCase())
        : null;
      const rawUsername = (
        user.username ||
        (user.unsafeMetadata?.username as string) ||
        localSavedName ||
        user.firstName ||
        ''
      ).replace(/^@+/, '').trim();
      const emailName = email.includes('@') ? email.split('@')[0] : email;
      const resolvedUsername = rawUsername || emailName || 'author';

      const profile: AppUserProfile = {
        id: user.id,
        email,
        fullName: resolvedUsername,
        avatarUrl: user.imageUrl,
        provider: 'clerk',
      };
      syncUserProfileToSupabase(profile).catch(() => {});
      onUserChange(profile);
    }
  }, [isLoaded, isSignedIn, user, onUserChange]);

  return null;
};
