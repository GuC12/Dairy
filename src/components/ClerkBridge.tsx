import React, { useEffect } from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from '@clerk/clerk-react';
import { Cloud, KeyRound, LogIn, UserPlus } from 'lucide-react';
import {
  syncUserProfileToSupabase,
  type AppUserProfile,
} from '../lib/supabaseClient';

interface ClerkBridgeProps {
  hasSupabase: boolean;
  onUserChange: (user: AppUserProfile | null) => void;
  onOpenKeysModal: () => void;
}

export const ClerkBridge: React.FC<ClerkBridgeProps> = ({
  hasSupabase,
  onUserChange,
  onOpenKeysModal,
}) => {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && user) {
      const profile: AppUserProfile = {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? '',
        fullName:
          user.fullName ||
          user.username ||
          user.primaryEmailAddress?.emailAddress?.split('@')[0] ||
          'Автор дневника',
        avatarUrl: user.imageUrl,
        provider: 'clerk',
      };
      syncUserProfileToSupabase(profile).catch(() => {});
      onUserChange(profile);
    } else {
      onUserChange(null);
    }
  }, [isLoaded, isSignedIn, user, onUserChange]);

  return (
    <div className="header-auth-wrap">
      <SignedOut>
        <SignInButton mode="modal">
          <button type="button" className="btn-secondary btn-auth-compact">
            <LogIn size={14} />
            Вход
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" className="btn-primary btn-auth-compact">
            <UserPlus size={14} />
            Регистрация
          </button>
        </SignUpButton>
      </SignedOut>

      <SignedIn>
        <div className="user-pill-box">
          {hasSupabase && (
            <span
              className="cloud-sync-dot font-mono"
              title="Синхронизировано с Supabase"
            >
              <Cloud size={12} />
              Supabase
            </span>
          )}
          <UserButton />
        </div>
      </SignedIn>

      <button
        type="button"
        className="btn-ghost btn-icon-only"
        onClick={onOpenKeysModal}
        title="Настройки ключей Clerk & Supabase"
      >
        <KeyRound size={14} />
      </button>
    </div>
  );
};
