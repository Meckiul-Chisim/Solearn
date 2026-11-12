import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PointsHeader from "@/components/points-header";
import { useSolearn } from "@/context/solearn-context";

const redemptionMethods = [
  {
    icon: "↗",
    title: "UPI request",
    description: "Submit your UPI ID and the number of points to redeem.",
  },
  {
    icon: "▣",
    title: "Gift-card request",
    description: "Submit an email address. Brand and value are agreed during review.",
  },
];

export default function ShopScreen() {
  const { user } = useSolearn();

  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1" edges={["top"]}>
        <PointsHeader />
        <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
          <View className="mx-auto w-full max-w-[760px] px-5 pt-7">
            <Text className="text-[11px] font-black uppercase tracking-[1.7px] text-[#2B8052]">
              REDEEM POINTS
            </Text>
            <Text className="mt-2 text-[32px] font-black tracking-tight text-[#17251D]">
              Choose a request.
            </Text>
            <Text className="mt-2 text-sm leading-5 text-[#7B857D]">
              Your balance is {user?.points.toLocaleString("en-IN") ?? "0"} points.
              Requests start at 1,000 points and are reviewed manually.
            </Text>

            <View className="mt-6 gap-3">
              {redemptionMethods.map((method) => (
                <View
                  key={method.title}
                  className="flex-row items-center rounded-[22px] border border-[#E5E9E2] bg-white p-5"
                >
                  <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3EC]">
                    <Text className="text-2xl text-[#287A4B]">{method.icon}</Text>
                  </View>
                  <View className="ml-4 flex-1">
                    <Text className="text-base font-extrabold text-[#17251D]">{method.title}</Text>
                    <Text className="mt-1 text-xs leading-5 text-[#7B857D]">{method.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View className="mt-5 rounded-2xl bg-[#FFF6E5] p-4">
              <Text className="text-sm font-extrabold text-[#745A22]">Manual fulfilment</Text>
              <Text className="mt-1 text-xs leading-5 text-[#816D42]">
                Points are reserved when you submit. No rupee conversion, gift-card brand, or denomination is configured, and no payment or card is sent automatically.
              </Text>
            </View>

            <Link href="/wallet" asChild>
              <Pressable className="mt-5 items-center rounded-xl bg-[#174D35] py-4">
                <Text className="font-extrabold text-white">Create a request</Text>
              </Pressable>
            </Link>
            <Link href="/learn" className="mt-5 self-center text-sm font-black text-[#287A4B]">
              Earn more with a quiz →
            </Link>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
