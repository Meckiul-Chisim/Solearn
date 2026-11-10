import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PointsHeader from "@/components/points-header";
import { useSolearn } from "@/context/solearn-context";

export default function RewardsScreen() {
  const { user, request, refreshUser } = useSolearn();
  const [claiming, setClaiming] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const claimDailyReward = async () => {
    setClaiming(true);
    setError(null);
    setClaimMessage(null);
    try {
      const result = await request<{ pointsAwarded: number; streak: number }>("/rewards/daily", {
        method: "POST",
        body: {},
      });
      await refreshUser();
      setClaimMessage(`You earned ${result.pointsAwarded} points. Your streak is ${result.streak} day${result.streak === 1 ? "" : "s"}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not claim your daily reward.");
    } finally {
      setClaiming(false);
    }
  };

  const inviteFriend = async () => {
    await Share.share({
      message: `Join me on SoloEarn and learn your way to rewards. Use my referral code: ${user?.referralCode ?? ""}`,
    });
  };

  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1" edges={["top"]}>
        <PointsHeader />
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="mx-auto w-full max-w-[760px] px-5 pt-7">
            <Text className="text-[11px] font-black uppercase tracking-[1.6px] text-[#2B8052]">
              REWARDS CENTRE
            </Text>
            <Text className="mt-2 text-[32px] font-black text-[#17251D]">
              Earn a little extra.
            </Text>
            <Text className="mt-2 text-sm leading-5 text-[#7B857D]">
              Build a learning habit and make every visit count.
            </Text>

            <View className="mt-6 rounded-[24px] bg-[#174D35] p-5">
              <Text className="text-xs font-bold tracking-wider text-white/65">
                DAILY CHECK-IN
              </Text>
              <Text className="mt-2 text-2xl font-black text-white">
                Your daily reward
              </Text>
              <Text className="mt-1 text-sm text-white/65">
                Check in once a day. Rewards are added to your account balance.
              </Text>
              <View className="mt-5 rounded-xl bg-white/10 p-4">
                <Text className="text-sm font-extrabold text-white">
                  Current streak: {user?.streak ?? 0} day{user?.streak === 1 ? "" : "s"}
                </Text>
                <Text className="mt-1 text-xs text-white/70">
                  Daily points grow with your streak, up to 50 points.
                </Text>
              </View>
              <Pressable
                onPress={() => void claimDailyReward()}
                disabled={claiming || !user?.canClaimDaily}
                className={`mt-5 items-center rounded-xl py-3.5 ${user?.canClaimDaily && !claiming ? "bg-[#F4C85E]" : "bg-white/25"}`}
              >
                <Text className={`font-black ${user?.canClaimDaily && !claiming ? "text-[#233B2B]" : "text-white"}`}>
                  {claiming ? "Claiming…" : user?.canClaimDaily ? "Claim daily reward" : "Already claimed today"}
                </Text>
              </Pressable>
              {claimMessage && <Text className="mt-3 text-center text-xs font-bold text-white">{claimMessage}</Text>}
              {error && <Text className="mt-3 text-center text-xs font-bold text-[#FFD9CE]">{error}</Text>}
            </View>

            <Text className="mt-8 text-xl font-black text-[#17251D]">Play & earn</Text>
            <Link href="/spin" asChild>
              <Pressable className="mt-4 flex-row items-center rounded-[22px] border border-[#E5E9E2] bg-white p-5">
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF2D8]">
                  <Text className="text-3xl">◎</Text>
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-base font-extrabold text-[#17251D]">Lucky spin</Text>
                  <Text className="mt-1 text-xs leading-5 text-[#7B857D]">
                    {user?.canSpin ? "Your daily spin is ready." : "You’ve used today’s spin. Come back tomorrow."}
                  </Text>
                  <Text className="mt-2 text-[10px] font-black tracking-wider text-[#B17B22]">
                    {user?.canSpin ? "1 FREE SPIN · DAILY" : "NEXT SPIN · TOMORROW"}
                  </Text>
                </View>
                <Text className="text-xl font-bold text-[#287A4B]">→</Text>
              </Pressable>
            </Link>

            <View className="mt-3 rounded-[22px] border border-[#E5E9E2] bg-white p-5">
              <Text className="font-extrabold text-[#17251D]">Invite a friend</Text>
              <Text className="mt-1 text-xs leading-5 text-[#7B857D]">
                Share your code. When a friend joins with it, they help you earn a referral bonus.
              </Text>
              <View className="mt-4 flex-row items-center justify-between rounded-xl bg-[#F4F6F2] p-3">
                <Text className="text-sm font-black tracking-[1.5px] text-[#287A4B]">
                  {user?.referralCode ?? "—"}
                </Text>
                <Pressable onPress={() => void inviteFriend()} className="rounded-lg bg-[#EAF3EC] px-3 py-2">
                  <Text className="text-xs font-extrabold text-[#287A4B]">Share code</Text>
                </Pressable>
              </View>
            </View>
            <Text className="mt-5 text-center text-xs leading-5 text-[#849087]">
              SoloEarn is ad-free. Daily rewards and quiz points are validated by the server.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
