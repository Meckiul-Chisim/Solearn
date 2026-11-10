import { useState } from 'react';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PointsHeader from '@/components/points-header';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function RewardsScreen() {
  const { user, refreshUser } = useAuth();
  const [award, setAward] = useState<{ points: number; streak: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claimed = !!user?.claimedToday || !!award;
  const streak = award?.streak ?? user?.streak ?? 0;
  const daysDone = Math.min(streak, WEEK.length);

  const claim = async () => {
    if (busy || claimed) return;
    setBusy(true);
    setError(null);
    try {
      const { pointsAwarded, streak: newStreak } = await api.claimDaily();
      setAward({ points: pointsAwarded, streak: newStreak });
      await refreshUser(); // Update the balance in the header.
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not claim your reward.');
      if (e instanceof ApiError && e.status === 409) refreshUser(); // Already claimed elsewhere.
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <PointsHeader />
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="mx-auto w-full max-w-[760px] px-5 pt-7">
            <Text className="text-[11px] font-black uppercase tracking-[1.6px] text-[#2B8052]">REWARDS CENTRE</Text>
            <Text className="mt-2 text-[32px] font-black text-[#17251D]">Earn a little extra.</Text>
            <Text className="mt-2 text-sm leading-5 text-[#7B857D]">Build a daily habit and make every visit count.</Text>

            {/* Daily check-in: real claim through the API */}
            <View className="mt-6 rounded-[24px] bg-[#174D35] p-5">
              <Text className="text-xs font-bold tracking-wider text-white/65">DAILY CHECK-IN</Text>
              <Text className="mt-2 text-2xl font-black text-white">Your daily reward</Text>
              <Text className="mt-1 text-sm text-white/65">Check in every day: the longer your streak, the more you earn.</Text>

              <View className="mt-5 flex-row gap-2">
                {WEEK.map((day, i) => {
                  const filled = i < daysDone;
                  return (
                    <View key={i} className={`h-9 flex-1 items-center justify-center rounded-full ${filled ? 'bg-[#F4C85E]' : 'bg-white/15'}`}>
                      <Text className={`text-xs font-black ${filled ? 'text-[#24412E]' : 'text-white'}`}>{filled ? '✓' : day}</Text>
                    </View>
                  );
                })}
              </View>

              <Pressable onPress={claim} disabled={claimed || busy} className="mt-5 items-center rounded-xl bg-[#F4C85E] py-3.5">
                {busy ? (
                  <ActivityIndicator color="#233B2B" />
                ) : (
                  <Text className="font-black text-[#233B2B]">{claimed ? 'Daily reward claimed ✓' : 'Claim daily points'}</Text>
                )}
              </Pressable>

              {award && (
                <Text className="mt-3 text-center text-xs font-bold text-white/80">
                  +{award.points} points · {award.streak}-day streak
                </Text>
              )}
              {!award && claimed && <Text className="mt-3 text-center text-xs font-bold text-white/75">Come back tomorrow to keep your streak going.</Text>}
              {error && <Text className="mt-3 text-center text-xs font-bold text-[#F7D77C]">{error}</Text>}
            </View>

            <Text className="mt-8 text-xl font-black text-[#17251D]">Play & earn</Text>

            <Link href="/spin" asChild>
              <Pressable className="mt-4 flex-row items-center rounded-[22px] border border-[#E5E9E2] bg-white p-5">
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF2D8]">
                  <Text className="text-3xl">◎</Text>
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-base font-extrabold text-[#17251D]">Lucky spin</Text>
                  <Text className="mt-1 text-xs leading-5 text-[#7B857D]">Open the spin wheel on its own page and try for bonus points.</Text>
                  <Text className="mt-2 text-[10px] font-black tracking-wider text-[#B17B22]">PREVIEW · NOT YET CONNECTED</Text>
                </View>
                <Text className="text-xl font-bold text-[#287A4B]">→</Text>
              </Pressable>
            </Link>

            <View className="mt-3 rounded-[22px] border border-[#E5E9E2] bg-white p-5">
              <View className="flex-row items-center">
                <View className="h-12 w-12 items-center justify-center rounded-xl bg-[#EAF0FF]">
                  <Text className="text-2xl">▶</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-extrabold text-[#17251D]">Watch & earn</Text>
                  <Text className="mt-1 text-xs text-[#7B857D]">Watch a sponsored video to collect points.</Text>
                </View>
              </View>
              <View className="mt-4 rounded-xl bg-[#F4F6F2] p-3">
                <Text className="text-xs leading-5 text-[#6F7A71]">
                  Rewarded ads will be connected when an ad network is configured. Points should only be credited after a verified completed view.
                </Text>
              </View>
              <View className="mt-4 items-center rounded-xl border border-[#DCE4DB] py-3">
                <Text className="font-extrabold text-[#287A4B]">Ad rewards coming soon</Text>
              </View>
            </View>

            <View className="mt-3 rounded-[22px] border border-[#E5E9E2] bg-white p-5">
              <Text className="font-extrabold text-[#17251D]">Invite a friend</Text>
              <Text className="mt-1 text-xs text-[#7B857D]">Share your code and earn 50 points when a friend signs up with it.</Text>
              <Text className="mt-4 text-[10px] font-black uppercase tracking-wider text-[#849087]">YOUR REFERRAL CODE</Text>
              <Text selectable className="mt-1 text-2xl font-black tracking-widest text-[#287A4B]">{user?.referralCode ?? '—'}</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
