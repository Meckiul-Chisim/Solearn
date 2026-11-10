import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

type Mode = 'signIn' | 'signUp';

const inputClass = 'mt-2 rounded-xl border border-[#E5E9E2] bg-[#FAFBF8] px-4 py-3 text-base text-[#17251D]';
const labelClass = 'mt-4 text-xs font-extrabold text-[#26352B]';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'signUp';

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (isSignUp) {
        await signUp({
          name: name.trim(),
          email: email.trim(),
          password,
          referralCode: referralCode.trim() || undefined,
        });
      } else {
        await signIn(email.trim(), password);
      }
      // On success the auth state changes and the router moves to the app.
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 32 }}>
            <View className="mx-auto w-full max-w-[460px] px-5">
              <Text className="text-[11px] font-black uppercase tracking-[1.7px] text-[#2B8052]">SOLOEARN</Text>
              <Text className="mt-2 text-[32px] font-black tracking-tight text-[#17251D]">
                {isSignUp ? 'Create your account.' : 'Welcome back.'}
              </Text>
              <Text className="mt-2 text-sm leading-5 text-[#7B857D]">
                {isSignUp ? 'Start learning and collecting points today.' : 'Sign in to keep learning and earning.'}
              </Text>

              <View className="mt-6 rounded-3xl border border-[#E5E9E2] bg-white p-5">
                {isSignUp && (
                  <>
                    <Text className="text-xs font-extrabold text-[#26352B]">Name</Text>
                    <TextInput value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" className={inputClass} />
                  </>
                )}

                <Text className={isSignUp ? labelClass : 'text-xs font-extrabold text-[#26352B]'}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  className={inputClass}
                />

                <Text className={labelClass}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={isSignUp ? 'At least 8 characters' : 'Your password'}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  onSubmitEditing={submit}
                  className={inputClass}
                />

                {isSignUp && (
                  <>
                    <Text className={labelClass}>Referral code (optional)</Text>
                    <TextInput
                      value={referralCode}
                      onChangeText={setReferralCode}
                      placeholder="e.g. 8D7751B7"
                      autoCapitalize="characters"
                      className={inputClass}
                    />
                  </>
                )}

                {error && (
                  <View className="mt-4 rounded-xl bg-[#FFF1EC] p-3">
                    <Text className="text-sm font-bold text-[#A44A2B]">{error}</Text>
                  </View>
                )}

                <Pressable
                  onPress={submit}
                  disabled={busy}
                  className={`mt-5 items-center rounded-xl py-4 ${busy ? 'bg-[#8FB09C]' : 'bg-[#174D35]'}`}>
                  {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-extrabold text-white">{isSignUp ? 'Create account' : 'Sign in'}</Text>}
                </Pressable>
              </View>

              <Pressable onPress={() => switchMode(isSignUp ? 'signIn' : 'signUp')} className="mt-5 items-center py-2">
                <Text className="text-sm font-bold text-[#2B8052]">
                  {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
