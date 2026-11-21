import React, { useEffect } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import {
  syncUserProfileToSupabase,
  type AppUserProfile,
} from '../lib/supabaseClient';
import {
  getUsernameByEmail,
  saveUsernameEmailMap,
} from './AuthModal';

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
      const metaUsername =
        typeof user.unsafeMetadata?.username === 'string'
          ? user.unsafeMetadata.username
          : '';
      const resolvedUsername =
        user.username ||
        metaUsername ||
        (email ? getUsernameByEmail(email) : null) ||
        user.firstName ||
        email.split('@')[0] ||
        'author';

      if (email && resolvedUsername) {
        saveUsernameEmailMap(resolvedUsername, email);
      }

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
