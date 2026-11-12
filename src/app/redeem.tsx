import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PointsHeader from "@/components/points-header";

export default function RedeemScreen() {
  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1" edges={["top"]}>
        <PointsHeader />
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingBottom: 36 }}>
          <View className="mx-auto w-full max-w-[600px] px-5">
            <Text className="text-[11px] font-black uppercase tracking-[1.7px] text-[#2B8052]">
              REDEMPTION REQUESTS
            </Text>
            <Text className="mt-2 text-[32px] font-black text-[#17251D]">
              Redeem your points.
            </Text>
            <Text className="mt-3 text-sm leading-6 text-[#7B857D]">
              Submit a UPI or gift-card request from your wallet. Requests reserve points and are reviewed manually. No rupee conversion, card denomination, or automatic fulfilment is configured.
            </Text>
            <Link href="/wallet" asChild>
              <Pressable className="mt-6 items-center rounded-xl bg-[#174D35] py-4">
                <Text className="font-extrabold text-white">Go to wallet</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
