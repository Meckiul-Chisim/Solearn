import { useCallback, useEffect, useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PointsHeader from "@/components/points-header";
import { Activity, useSolearn } from "@/context/solearn-context";

type PayoutMethod = "UPI" | "Gift card";
type WithdrawalResult = { status: string };

export default function WalletScreen() {
  const { user, request, refreshUser, signOut } = useSolearn();
  const [method, setMethod] = useState<PayoutMethod>("UPI");
  const [amount, setAmount] = useState("1000");
  const [details, setDetails] = useState("");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    setLoadingActivity(true);
    try {
      const result = await request<{ activity: Activity[] }>("/activity");
      setActivity(result.activity);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load account activity.");
    } finally {
      setLoadingActivity(false);
    }
  }, [request]);

  useEffect(() => {
    let active = true;
    const fetchActivity = async () => {
      try {
        const result = await request<{ activity: Activity[] }>("/activity");
        if (active) setActivity(result.activity);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Could not load account activity.");
      } finally {
        if (active) setLoadingActivity(false);
      }
    };
    void fetchActivity();
    return () => {
      active = false;
    };
  }, [request]);

  const submitWithdrawal = async () => {
    const points = Number(amount);
    const destination = details.trim();
    if (!Number.isInteger(points) || points < 1000) {
      setError("Enter at least 1,000 points.");
      return;
    }
    if (points > (user?.points ?? 0)) {
      setError("Your balance is not high enough for this request.");
      return;
    }
    const validDestination = method === "UPI"
      ? /^[\w.-]+@[\w.-]+$/.test(destination)
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination);
    if (!validDestination) {
      setError(method === "UPI" ? "Enter a valid UPI ID." : "Enter a valid email address for your gift card.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await request<WithdrawalResult>("/withdrawals", {
        method: "POST",
        body: { points, method, details: destination },
      });
      await refreshUser();
      await loadActivity();
      setMessage(`Your ${points.toLocaleString("en-IN")} point request is ${result.status}. It is not an instant payout.`);
      setDetails("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit your request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1" edges={["top"]}>
        <PointsHeader />
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="mx-auto w-full max-w-[720px] px-5 pt-5">
            <Text className="text-xs font-bold uppercase tracking-[1.5px] text-[#7B857D]">
              YOUR WALLET
            </Text>
            <Text className="mt-1 text-[30px] font-black text-[#17251D]">
              Points to possibilities.
            </Text>
            <Text className="mt-2 text-sm text-[#7B857D]">
              Your balance and reward activity are saved to your account.
            </Text>

            <View className="mt-6 rounded-3xl bg-[#174D35] p-5">
              <Text className="text-sm font-bold text-white/70">TOTAL POINTS</Text>
              <Text className="mt-2 text-[38px] font-black text-white">
                {(user?.points ?? 0).toLocaleString("en-IN")}{" "}
                <Text className="text-base text-[#CBE6D1]">pts</Text>
              </Text>
              <View className="mt-4 flex-row justify-between border-t border-white/15 pt-4">
                <View>
                  <Text className="text-xs text-white/60">Current streak</Text>
                  <Text className="mt-1 font-extrabold text-white">
                    {user?.streak ?? 0} day{user?.streak === 1 ? "" : "s"}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xs text-white/60">Account</Text>
                  <Text className="mt-1 font-extrabold text-white">{user?.email}</Text>
                </View>
              </View>
            </View>

            <Text className="mt-7 text-xl font-black text-[#17251D]">Request a payout</Text>
            <Text className="mt-1 text-xs leading-5 text-[#7B857D]">
              Requests start at 1,000 points and are queued for manual review. Payout providers are not connected yet.
            </Text>
            <View className="mt-4 flex-row gap-2">
              {(["UPI", "Gift card"] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setMethod(option)}
                  className={`flex-1 items-center rounded-xl border py-3 ${method === option ? "border-[#287A4B] bg-[#EAF3EC]" : "border-[#E5E9E2] bg-white"}`}
                >
                  <Text className={`text-xs font-extrabold ${method === option ? "text-[#287A4B]" : "text-[#7B857D]"}`}>
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View className="mt-4 rounded-2xl border border-[#E5E9E2] bg-white p-5">
              <Text className="text-sm font-extrabold text-[#17251D]">Points to request</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                placeholder="Minimum 1,000"
                className="mt-3 rounded-xl border border-[#E5E9E2] bg-[#FAFBF8] px-4 py-3 text-base font-bold text-[#17251D]"
              />
              <Text className="mt-2 text-xs text-[#7B857D]">
                Available: {(user?.points ?? 0).toLocaleString("en-IN")} points
              </Text>
              <Text className="mt-5 text-sm font-extrabold text-[#17251D]">
                {method === "UPI" ? "UPI ID" : "Email for gift card"}
              </Text>
              <TextInput
                value={details}
                onChangeText={setDetails}
                autoCapitalize="none"
                keyboardType={method === "UPI" ? "email-address" : "email-address"}
                placeholder={method === "UPI" ? "name@bank" : "you@example.com"}
                className="mt-3 rounded-xl border border-[#E5E9E2] bg-[#FAFBF8] px-4 py-3 text-sm text-[#17251D]"
              />
              {error && <Text className="mt-3 text-sm font-semibold text-[#B34B36]">{error}</Text>}
              {message && <Text className="mt-3 text-sm font-semibold text-[#287A4B]">{message}</Text>}
              <Pressable
                onPress={() => void submitWithdrawal()}
                disabled={submitting || (user?.points ?? 0) < 1000}
                className={`mt-5 items-center rounded-xl py-4 ${!submitting && (user?.points ?? 0) >= 1000 ? "bg-[#287A4B]" : "bg-[#AAB8AC]"}`}
              >
                <Text className="font-extrabold text-white">
                  {submitting ? "Submitting…" : "Submit payout request"}
                </Text>
              </Pressable>
            </View>

            <View className="mt-7 flex-row items-center justify-between">
              <Text className="text-xl font-black text-[#17251D]">Recent activity</Text>
              <Pressable onPress={() => void loadActivity()}>
                <Text className="text-xs font-extrabold text-[#287A4B]">Refresh</Text>
              </Pressable>
            </View>
            <View className="mt-3 rounded-2xl border border-[#E5E9E2] bg-white p-4">
              {loadingActivity ? (
                <Text className="text-sm text-[#7B857D]">Loading activity…</Text>
              ) : activity.length === 0 ? (
                <Text className="text-sm leading-5 text-[#7B857D]">
                  No activity yet. Complete a quiz or claim your daily reward to get started.
                </Text>
              ) : activity.map((item, index) => (
                <View key={`${item.createdAt}-${index}`} className="flex-row items-center justify-between border-b border-[#EDF0EA] py-3">
                  <View className="mr-3 flex-1">
                    <Text className="text-sm font-bold capitalize text-[#26352B]">{item.description}</Text>
                    <Text className="mt-1 text-[10px] text-[#849087]">
                      {new Date(`${item.createdAt.replace(" ", "T")}Z`).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text className={`text-sm font-black ${item.points >= 0 ? "text-[#287A4B]" : "text-[#8D3E2A]"}`}>
                    {item.points > 0 ? "+" : ""}{item.points.toLocaleString("en-IN")} pts
                  </Text>
                </View>
              ))}
            </View>

            <Link href="/rewards" className="mt-5 text-sm font-black text-[#287A4B]">
              Explore rewards →
            </Link>
            <Pressable onPress={() => void signOut()} className="mt-6 self-start rounded-xl border border-[#E5E9E2] bg-white px-4 py-3">
              <Text className="text-sm font-extrabold text-[#7B857D]">Sign out</Text>
            </Pressable>
            <Text className="mt-5 text-center text-xs leading-5 text-[#8A938B]">
              Point balances are managed by the SoloEarn server. Payout and gift-card requests remain pending until a provider is configured.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
