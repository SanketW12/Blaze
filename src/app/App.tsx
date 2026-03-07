import { NutritionPage } from '@/features/Dashboard';
import { ChatPage } from '@/features/Chat';
import { HomePage } from '@/features/Home';
import { CommunicationPage } from '@/features/Communication';
import { HomeHeader } from '@/features/Home/components/HomeHeader';
import FooterNavbar from './FooterNavbar';
import type { FooterTab } from './FooterNavbar';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const APP_LOCK_ENABLED_KEY = 'blaze-app-lock-enabled';
const APP_LOCK_BIOMETRIC_ID_KEY = 'blaze-app-lock-biometric-id';

const bufferToBase64Url = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlToBuffer = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '==='.slice((base64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

const createRandomBuffer = (length = 32) => {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return buffer.buffer;
};

const App = () => {
  const [activeTab, setActiveTab] = useState<FooterTab>('home');
  const [homeView, setHomeView] = useState<'home' | 'nutrition' | 'communication'>('home');
  const [isLocked, setIsLocked] = useState(false);
  const [hasPassedLockGate, setHasPassedLockGate] = useState(false);
  const [biometricCredentialId, setBiometricCredentialId] = useState<string | null>(null);
  const [showLockSetup, setShowLockSetup] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [isUnlockingBiometric, setIsUnlockingBiometric] = useState(false);
  const [isEnablingBiometric, setIsEnablingBiometric] = useState(false);
  const [isPlatformAuthenticatorAvailable, setIsPlatformAuthenticatorAvailable] = useState(false);

  const hasAnyUnlockMethod = Boolean(biometricCredentialId);
  const canUseWebAuthn =
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials !== 'undefined';

  const renderActiveScreen = () => {
    if (activeTab === 'chat') return <ChatPage />;
    if (activeTab === 'home') {
      if (homeView === 'nutrition') {
        return <NutritionPage onBackToHome={() => setHomeView('home')} />;
      }
      if (homeView === 'communication') {
        return <CommunicationPage onBackToHome={() => setHomeView('home')} />;
      }
      return (
        <HomePage
          onOpenCommunication={() => setHomeView('communication')}
          onOpenNutrition={() => setHomeView('nutrition')}
        />
      );
    }
    if (activeTab === 'history') {
      return (
        <main className='min-h-screen bg-card text-foreground pb-24'>
          <section className='mx-auto w-full max-w-lg p-4'>
            <Card className='bg-muted/25 shadow-none'>
              <div className='p-4'>
                <p className='text-lg font-semibold'>History</p>
                <p className='text-sm text-muted-foreground'>History page coming soon.</p>
              </div>
            </Card>
          </section>
        </main>
      );
    }
    if (activeTab === 'settings') {
      return (
        <main className='min-h-screen bg-card text-foreground pb-24'>
          <section className='mx-auto w-full max-w-lg p-4'>
            <Card className='bg-muted/25 shadow-none'>
              <div className='p-4'>
                <p className='text-lg font-semibold'>Settings</p>
                <p className='text-sm text-muted-foreground'>Settings page coming soon.</p>
              </div>
            </Card>
          </section>
        </main>
      );
    }
    return null;
  };

  useEffect(() => {
    const storedBiometricId = localStorage.getItem(APP_LOCK_BIOMETRIC_ID_KEY);
    localStorage.removeItem('blaze-app-lock-pin-hash');

    const hasBiometricLock = Boolean(storedBiometricId);
    setBiometricCredentialId(storedBiometricId);
    // Always gate app entry first: lock if credential exists, otherwise force setup screen.
    setIsLocked(hasBiometricLock);
    setShowLockSetup(!hasBiometricLock);
    setHasPassedLockGate(false);

    const checkPlatformAuthenticator = async () => {
      if (!canUseWebAuthn) return;
      const isAvailable =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setIsPlatformAuthenticatorAvailable(isAvailable);
    };
    void checkPlatformAuthenticator();
  }, [canUseWebAuthn]);

  const handleEnableBiometricLock = async () => {
    if (!canUseWebAuthn) {
      setLockError('Biometric unlock is not supported on this browser/device.');
      return;
    }

    setLockError(null);
    setIsEnablingBiometric(true);

    try {
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: createRandomBuffer(),
          rp: {
            name: 'Blaze'
          },
          user: {
            id: createRandomBuffer(16),
            name: 'blaze-user',
            displayName: 'Blaze User'
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            residentKey: 'required',
            userVerification: 'required'
          },
          timeout: 60000,
          attestation: 'none'
        }
      })) as PublicKeyCredential | null;

      if (!credential) {
        throw new Error('Could not create biometric credential.');
      }

      const credentialId = bufferToBase64Url(credential.rawId);
      localStorage.setItem(APP_LOCK_BIOMETRIC_ID_KEY, credentialId);
      localStorage.setItem(APP_LOCK_ENABLED_KEY, 'true');
      setBiometricCredentialId(credentialId);
      setIsLocked(false);
      setShowLockSetup(false);
      setHasPassedLockGate(true);
    } catch (error) {
      setLockError(error instanceof Error ? error.message : 'Failed to enable biometric lock.');
    } finally {
      setIsEnablingBiometric(false);
    }
  };

  const handleUnlockWithBiometric = async () => {
    if (!biometricCredentialId || !canUseWebAuthn) return;
    setLockError(null);
    setIsUnlockingBiometric(true);

    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: createRandomBuffer(),
          allowCredentials: [
            {
              id: base64UrlToBuffer(biometricCredentialId),
              type: 'public-key'
            }
          ],
          userVerification: 'required',
          timeout: 60000
        }
      });

      if (!assertion) {
        throw new Error('Biometric authentication was cancelled.');
      }

      setIsLocked(false);
      setHasPassedLockGate(true);
    } catch (error) {
      setLockError(error instanceof Error ? error.message : 'Biometric authentication failed.');
    } finally {
      setIsUnlockingBiometric(false);
    }
  };

  return (
    <>
      {hasPassedLockGate && !isLocked ? (
        <Card className='border-none  shadow-none bg-card rounded-none'>
          <div className='mx-auto w-full max-w-lg p-4 space-y-5 min-h-screen '>



            {
              activeTab === 'home' && (
                <HomeHeader />
              )
            }

            {renderActiveScreen()}
            <FooterNavbar onValueChange={setActiveTab} value={activeTab} />
          </div>

        </Card>
      ) : null}



      {isLocked || showLockSetup ? (
        <div className='fixed inset-0 z-100 flex items-center justify-center bg-background/95 px-4 backdrop-blur-md'>
          <Card className='w-full max-w-sm rounded-2xl border-border/60 p-5'>
            <div className='mb-4 text-center'>
              <img
                alt='Blaze logo'
                className='mx-auto mb-3 h-14 w-14 rounded-xl'
                src='/favicon.png'
              />
              <p className='text-xl font-semibold'>{isLocked ? 'App Locked' : 'Enable App Lock'}</p>
              <p className='text-sm text-muted-foreground'>
                {isLocked
                  ? 'Unlock Blaze with your device lock'
                  : 'Use Face ID / Touch ID from your phone or laptop'}
              </p>
            </div>

            <div className='space-y-3'>
              {biometricCredentialId ? (
                <Button
                  className='w-full'
                  disabled={isUnlockingBiometric}
                  onClick={() => {
                    void handleUnlockWithBiometric();
                  }}
                  type='button'
                >
                  {isUnlockingBiometric ? 'Waiting for Face ID / Touch ID...' : 'Unlock with Face ID / Touch ID'}
                </Button>
              ) : null}

              {!hasAnyUnlockMethod ? (
                <>
                  {isPlatformAuthenticatorAvailable ? (
                    <Button
                      className='w-full'
                      disabled={isEnablingBiometric}
                      onClick={() => {
                        void handleEnableBiometricLock();
                      }}
                      type='button'
                    >
                      {isEnablingBiometric
                        ? 'Preparing biometric lock...'
                        : 'Enable Face ID / Touch ID lock'}
                    </Button>
                  ) : (
                    <p className='text-sm text-muted-foreground'>
                      Device biometric lock is unavailable here. Use Safari/iOS home-screen app or a browser with platform authenticator support.
                    </p>
                  )}
                </>
              ) : null}
            </div>

            {lockError ? <p className='mt-3 text-sm text-destructive'>{lockError}</p> : null}
          </Card>
        </div>
      ) : null}
    </>
  );
};

export default App;
