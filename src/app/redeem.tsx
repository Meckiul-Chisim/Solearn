import { useCallback, useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PointsHeader from "@/components/points-header";
import { Product, useSolearn } from "@/context/solearn-context";

type RedemptionResult = {
  id: number;
  status: string;
  pointsDeducted: number;
};

export default function RedeemScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, request, refreshUser } = useSolearn();
  const [product, setProduct] = useState<Product | null>(null);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redemption, setRedemption] = useState<RedemptionResult | null>(null);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await request<{ products: Product[] }>("/products");
      setProduct(result.products.find((item) => item.id === id) ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load this reward.");
    } finally {
      setLoading(false);
    }
  }, [id, request]);

  useEffect(() => {
    let active = true;
    const fetchProduct = async () => {
      try {
        const result = await request<{ products: Product[] }>("/products");
        if (active) setProduct(result.products.find((item) => item.id === id) ?? null);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Could not load this reward.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchProduct();
    return () => {
      active = false;
    };
  }, [id, request]);

  const submitRedemption = async () => {
    if (!product || address.trim().length < 10) {
      setError("Enter delivery details with at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await request<RedemptionResult>("/redemptions", {
        method: "POST",
        body: { productId: product.id, details: address.trim() },
      });
      setRedemption(result);
      await refreshUser();
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
        <ScrollView contentContainerStyle={{ paddingBottom: 36 }}>
          <View className="mx-auto w-full max-w-[700px] px-5 pt-6">
            <Link href="/shop" className="text-sm font-bold text-[#2B8052]">
              ← Back to shop
            </Link>
            <Text className="mt-6 text-[11px] font-black uppercase tracking-[1.6px] text-[#2B8052]">
              REDEMPTION CENTRE
            </Text>
            <Text className="mt-2 text-[32px] font-black text-[#17251D]">
              Redeem your points.
            </Text>
            <Text className="mt-2 text-sm leading-5 text-[#7B857D]">
              Your request is checked against your account balance and queued for fulfilment.
            </Text>

            {loading ? (
              <View className="mt-6 items-center rounded-[24px] border border-[#E3E9E1] bg-white p-8">
                <Text className="text-sm font-bold text-[#287A4B]">Loading reward…</Text>
              </View>
            ) : error && !product ? (
              <View className="mt-6 rounded-[24px] border border-[#E3E9E1] bg-white p-5">
                <Text className="font-bold text-[#8D3E2A]">{error}</Text>
                <Pressable onPress={() => void loadProduct()} className="mt-4 rounded-xl bg-[#174D35] p-3">
                  <Text className="text-center font-extrabold text-white">Try again</Text>
                </Pressable>
              </View>
            ) : !product ? (
              <View className="mt-6 rounded-[24px] border border-[#E3E9E1] bg-white p-5">
                <Text className="font-bold text-[#17251D]">Choose a reward from the shop first.</Text>
                <Link href="/shop" className="mt-4 font-extrabold text-[#287A4B]">Browse rewards →</Link>
              </View>
            ) : (
              <>
                <View className="mt-6 rounded-[24px] border border-[#E3E9E1] bg-white p-5">
                  <Text className="text-[10px] font-black uppercase tracking-wider text-[#7B857D]">
                    YOUR SELECTION
                  </Text>
                  <Text className="mt-2 text-xl font-black text-[#17251D]">{product.name}</Text>
                  <View className="mt-4 border-t border-[#EDF0EA] pt-4">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-[#7B857D]">Points required</Text>
                      <Text className="text-lg font-black text-[#174D35]">
                        {product.points.toLocaleString("en-IN")} pts
                      </Text>
                    </View>
                    <View className="mt-3 flex-row items-center justify-between">
                      <Text className="text-sm font-semibold text-[#7B857D]">Available balance</Text>
                      <Text className="text-sm font-extrabold text-[#263B2C]">
                        {(user?.points ?? 0).toLocaleString("en-IN")} pts
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="mt-4 rounded-[24px] border border-[#E3E9E1] bg-white p-5">
                  <Text className="text-base font-extrabold text-[#17251D]">Delivery details</Text>
                  <Text className="mt-1 text-xs leading-5 text-[#7B857D]">
                    Provide a delivery address. Your request will remain pending until it is reviewed.
                  </Text>
                  <Text className="mt-5 text-xs font-extrabold text-[#26352B]">Delivery address</Text>
                  <TextInput
                    value={address}
                    onChangeText={setAddress}
                    multiline
                    maxLength={1000}
                    placeholder="Name, street address, city, postal code"
                    textAlignVertical="top"
                    editable={!redemption}
                    className="mt-2 min-h-[104px] rounded-xl border border-[#E5E9E2] bg-[#FAFBF8] px-4 py-3 text-sm text-[#17251D]"
                  />
                  {error && <Text className="mt-3 text-sm font-semibold text-[#B34B36]">{error}</Text>}
                  {!redemption ? (
                    <Pressable
                      onPress={() => void submitRedemption()}
                      disabled={submitting || (user?.points ?? 0) < product.points}
                      className={`mt-5 items-center rounded-xl py-4 ${(user?.points ?? 0) >= product.points && !submitting ? "bg-[#174D35]" : "bg-[#AAB8AC]"}`}
                    >
                      <Text className="font-extrabold text-white">
                        {submitting
                          ? "Submitting…"
                          : (user?.points ?? 0) < product.points
                            ? "Not enough points"
                            : "Submit redemption request"}
                      </Text>
                    </Pressable>
                  ) : (
                    <View className="mt-4 rounded-xl bg-[#EAF3EC] p-4">
                      <Text className="font-extrabold text-[#174D35]">Request submitted · Pending review</Text>
                      <Text className="mt-1 text-xs leading-5 text-[#496653]">
                        Request #{redemption.id}. {redemption.pointsDeducted.toLocaleString("en-IN")} points were deducted from your balance. Fulfilment is not instant.
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
            <Text className="mt-5 text-center text-[11px] leading-5 text-[#8A938B]">
              Redemption requests are recorded by the SoloEarn server. No ads or ad-based points are involved.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
