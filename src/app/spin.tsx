import { Fragment, useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import PointsHeader from "@/components/points-header";
import { useSolearn } from "@/context/solearn-context";

const segments = ["10 pts", "5 pts", "25 pts", "Try again", "50 pts", "5 pts", "20 pts", "Try again"];
const colors = ["#EAF3EC", "#FFF3D8", "#EAF0FF", "#FCEBE5", "#EAF3EC", "#FFF3D8", "#EAF0FF", "#FCEBE5"];
const point = (angle: number, radius: number) => ({
  x: 130 + radius * Math.cos(((angle - 90) * Math.PI) / 180),
  y: 130 + radius * Math.sin(((angle - 90) * Math.PI) / 180),
});
const wedge = (index: number) => {
  const start = index * 45;
  const end = start + 45;
  const first = point(start, 122);
  const second = point(end, 122);
  return `M 130 130 L ${first.x} ${first.y} A 122 122 0 0 1 ${second.x} ${second.y} Z`;
};

type SpinResult = {
  label: string;
  pointsAwarded: number;
  outcomeIndex: number;
};

export default function SpinScreen() {
  const { user, request, refreshUser } = useSolearn();
  const rotation = useSharedValue(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const shouldShowResult = !!result && !user?.canSpin;

  const finishSpin = (spinResult: SpinResult) => {
    setSpinning(false);
    setResult(spinResult);
  };

  const spin = async () => {
    if (spinning || !user?.canSpin) return;
    setSpinning(true);
    setError(null);
    try {
      const spinResult = await request<SpinResult>("/rewards/spin", {
        method: "POST",
        body: {},
      });
      const stopAt = (360 - (spinResult.outcomeIndex * 45 + 22.5) + 360) % 360;
      rotation.value = withTiming(
        360 * 5 + stopAt,
        { duration: 4200, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finishSpin)(spinResult);
        },
      );
      void refreshUser().catch((refreshError: unknown) => {
        setError(refreshError instanceof Error ? refreshError.message : "Could not refresh your balance.");
      });
    } catch (requestError) {
      setSpinning(false);
      setError(requestError instanceof Error ? requestError.message : "Could not use your daily spin.");
    }
  };

  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1" edges={["top"]}>
        <PointsHeader />
        <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
          <View className="mx-auto w-full max-w-[700px] items-center px-5 pt-6">
            <Link href="/rewards" className="self-start text-sm font-bold text-[#2B8052]">
              ← Back to rewards
            </Link>
            <Text className="mt-6 text-[11px] font-black uppercase tracking-[1.7px] text-[#2B8052]">
              DAILY BONUS
            </Text>
            <Text className="mt-2 text-center text-[32px] font-black text-[#17251D]">
              Give it a spin.
            </Text>
            <Text className="mt-2 max-w-[330px] text-center text-sm leading-5 text-[#7B857D]">
              The server picks your result and adds any points to your balance.
            </Text>

            <View className="mt-8 h-[300px] w-[300px] items-center justify-center">
              <View className="absolute top-0 z-10">
                <Text className="text-[34px] text-[#D99B35]">▼</Text>
              </View>
              <Animated.View style={wheelStyle}>
                <Svg width="276" height="276" viewBox="0 0 260 260">
                  <Circle cx="130" cy="130" r="127" fill="#174D35" />
                  {segments.map((label, index) => {
                    const mid = index * 45 + 22.5;
                    const labelPoint = point(mid, 78);
                    return (
                      <Fragment key={index}>
                        <Path d={wedge(index)} fill={colors[index]} stroke="#FFFFFF" strokeWidth="2" />
                        <SvgText
                          x={labelPoint.x}
                          y={labelPoint.y}
                          fill="#174D35"
                          fontSize="11"
                          fontWeight="800"
                          textAnchor="middle"
                          alignmentBaseline="middle"
                          transform={`rotate(${mid} ${labelPoint.x} ${labelPoint.y})`}
                        >
                          {label}
                        </SvgText>
                      </Fragment>
                    );
                  })}
                  <Circle cx="130" cy="130" r="22" fill="#174D35" stroke="#FFFFFF" strokeWidth="4" />
                  <SvgText x="130" y="134" fill="#FFFFFF" fontSize="10" fontWeight="900" textAnchor="middle">
                    GO
                  </SvgText>
                </Svg>
              </Animated.View>
            </View>

            {shouldShowResult ? (
              <View className="mt-4 items-center rounded-2xl border border-[#DDE7DC] bg-white px-7 py-4">
                <Text className="text-xs font-bold uppercase tracking-wider text-[#7B857D]">YOUR RESULT</Text>
                <Text className="mt-1 text-2xl font-black text-[#174D35]">{result?.label}</Text>
                <Text className="mt-1 text-xs text-[#7B857D]">
                  {result && result.pointsAwarded > 0
                    ? `${result.pointsAwarded} points added to your balance.`
                    : "No points this time. Try again tomorrow."}
                </Text>
              </View>
            ) : (
              <Text className="mt-3 text-sm font-semibold text-[#7B857D]">
                {spinning
                  ? "Your wheel is spinning…"
                  : user?.canSpin
                    ? "Your daily spin is ready"
                    : "You’ve already used today’s spin"}
              </Text>
            )}

            {error && <Text className="mt-4 text-center text-sm font-semibold text-[#B34B36]">{error}</Text>}
            <Pressable
              disabled={spinning || !user?.canSpin}
              onPress={() => void spin()}
              className={`mt-6 w-full max-w-[320px] items-center rounded-2xl py-4 ${spinning || !user?.canSpin ? "bg-[#AAB8AC]" : "bg-[#174D35]"}`}
            >
              <Text className="font-black text-white">
                {spinning ? "Spinning…" : !user?.canSpin ? "Come back tomorrow" : "SPIN NOW"}
              </Text>
            </Pressable>

            <View className="mt-7 w-full rounded-2xl bg-[#FFF6E5] p-4">
              <Text className="text-sm font-extrabold text-[#745A22]">One spin per day</Text>
              <Text className="mt-1 text-xs leading-5 text-[#816D42]">
                Your result is selected and saved by the server, so replaying the animation cannot award extra points.
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
