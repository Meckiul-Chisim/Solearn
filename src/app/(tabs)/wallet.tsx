import { useState } from 'react';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PointsHeader from '@/components/points-header';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

const METHODS = ['UPI', 'Gift card', 'Card'] as const;
const MIN_WITHDRAWAL = 1000; // Must match the backend rule.
const UPI_PATTERN = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;

const format = (n: number) => n.toLocaleString('en-IN');

export default function WalletScreen() {
  const { user, refreshUser, signOut } = useAuth();
  const [method, setMethod] = useState<(typeof METHODS)[number]>('UPI');
  const [amount, setAmount] = useState('1000');
  const [upi, setUpi] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<number | null>(null);

  const points = user?.points ?? 0;

  const submit = async () => {
    setError(null);
    setSubmitted(null);
    const requested = Number(amount);
    if (!Number.isInteger(requested) || requested < MIN_WITHDRAWAL) return setError(`Minimum withdrawal is ${format(MIN_WITHDRAWAL)} points.`);
    if (requested > points) return setError('You do not have enough points for that amount.');
    if (!UPI_PATTERN.test(upi.trim())) return setError('Enter a valid UPI ID, like name@bank.');

    setBusy(true);
    try {
      await api.withdraw({ points: requested, method, details: upi.trim() });
      setSubmitted(requested);
      await refreshUser();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not submit your request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <PointsHeader />
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="mx-auto w-full max-w-[720px] px-5 pt-5">
            <Link href="/" className="text-sm font-bold text-[#2B8052]">← Back to home</Link>
            <Text className="mt-5 text-xs font-bold uppercase tracking-[1.5px] text-[#7B857D]">YOUR WALLET</Text>
            <Text className="mt-1 text-[30px] font-black text-[#17251D]">Points to possibilities.</Text>
            <Text className="mt-2 text-sm text-[#7B857D]">Track your points and request a withdrawal.</Text>

            <View className="mt-6 rounded-3xl bg-[#174D35] p-5">
              <Text className="text-sm font-bold text-white/70">TOTAL POINTS</Text>
              <Text className="mt-2 text-[38px] font-black text-white">
                {format(points)} <Text className="text-base text-[#CBE6D1]">pts</Text>
              </Text>
              <View className="mt-4 flex-row justify-between border-t border-white/15 pt-4">
                <View>
                  <Text className="text-xs text-white/60">Lifetime earned</Text>
                  <Text className="mt-1 font-extrabold text-white">{format(user?.lifetimeEarned ?? 0)} pts</Text>
                </View>
                <View>
                  <Text className="text-xs text-white/60">Withdrawn</Text>
                  <Text className="mt-1 font-extrabold text-white">{format(user?.withdrawn ?? 0)} pts</Text>
                </View>
              </View>
            </View>

            <Text className="mt-7 text-xl font-black text-[#17251D]">Withdraw</Text>
            <Text className="mt-1 text-xs text-[#7B857D]">Choose a payout method.</Text>

            <View className="mt-4 flex-row gap-2">
              {METHODS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMethod(m)}
                  className={`flex-1 items-center rounded-xl border py-3 ${method === m ? 'border-[#287A4B] bg-[#EAF3EC]' : 'border-[#E5E9E2] bg-white'}`}>
                  <Text className={`text-xs font-extrabold ${method === m ? 'text-[#287A4B]' : 'text-[#7B857D]'}`}>{m}</Text>
                </Pressable>
              ))}
            </View>

            <View className="mt-4 rounded-2xl border border-[#E5E9E2] bg-white p-5">
              {method === 'UPI' ? (
                <>
                  <Text className="text-sm font-extrabold text-[#17251D]">Points to withdraw</Text>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="number-pad"
                    placeholder="Enter points"
                    className="mt-3 rounded-xl border border-[#E5E9E2] bg-[#FAFBF8] px-4 py-3 text-base font-bold text-[#17251D]"
                  />
                  <Text className="mt-2 text-xs text-[#7B857D]">Minimum {format(MIN_WITHDRAWAL)} points.</Text>

                  <Text className="mt-5 text-sm font-extrabold text-[#17251D]">UPI ID</Text>
                  <TextInput
                    value={upi}
                    onChangeText={setUpi}
                    autoCapitalize="none"
                    placeholder="name@bank"
                    className="mt-3 rounded-xl border border-[#E5E9E2] bg-[#FAFBF8] px-4 py-3 text-sm text-[#17251D]"
                  />

                  {error && (
                    <View className="mt-4 rounded-xl bg-[#FFF1EC] p-3">
                      <Text className="text-sm font-bold text-[#A44A2B]">{error}</Text>
                    </View>
                  )}

                  <Pressable onPress={submit} disabled={busy} className={`mt-5 items-center rounded-xl py-4 ${busy ? 'bg-[#8FB09C]' : 'bg-[#287A4B]'}`}>
                    {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-extrabold text-white">Request withdrawal</Text>}
                  </Pressable>

                  {submitted !== null && (
                    <View className="mt-4 rounded-xl bg-[#EDF7F0] p-3">
                      <Text className="text-sm font-extrabold text-[#287A4B]">Request received — {format(submitted)} points on hold</Text>
                      <Text className="mt-1 text-xs leading-5 text-[#4F7A60]">
                        Your request is pending review. No money has been sent yet: automatic payouts are not connected.
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View className="rounded-xl bg-[#F4F6F2] p-3">
                  <Text className="text-xs leading-5 text-[#6F7A71]">{method} redemption becomes available after the relevant payout or gift-card provider is integrated.</Text>
                </View>
              )}
            </View>

            <View className="mt-5 rounded-2xl bg-[#FFF3D8] p-4">
              <Text className="font-extrabold text-[#745A22]">A note about payouts</Text>
              <Text className="mt-1 text-xs leading-5 text-[#816D42]">
                Withdrawals are recorded as pending requests. Real UPI payouts need eligibility checks, a payout provider and fraud controls.
              </Text>
            </View>

            <View className="mt-6 flex-row items-center justify-between rounded-2xl border border-[#E5E9E2] bg-white p-4">
              <View className="flex-1 pr-3">
                <Text className="text-sm font-extrabold text-[#17251D]">{user?.name}</Text>
                <Text className="mt-0.5 text-xs text-[#7B857D]">{user?.email}</Text>
              </View>
              <Pressable onPress={signOut} className="rounded-xl border border-[#DCE4DB] px-4 py-2.5">
                <Text className="text-xs font-extrabold text-[#A44A2B]">Sign out</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
