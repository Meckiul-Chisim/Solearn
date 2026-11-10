import { useCallback, useEffect, useState } from "react";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PointsHeader from "@/components/points-header";
import { Product, useSolearn } from "@/context/solearn-context";

export default function ShopScreen() {
  const { user, request } = useSolearn();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await request<{ products: Product[] }>("/products");
      setProducts(result.products);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load rewards.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    let active = true;
    const fetchProducts = async () => {
      try {
        const result = await request<{ products: Product[] }>("/products");
        if (active) setProducts(result.products);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Could not load rewards.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchProducts();
    return () => {
      active = false;
    };
  }, [request]);

  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1" edges={["top"]}>
        <PointsHeader />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
          <View className="mx-auto w-full max-w-[760px] px-5 pt-7">
            <Text className="text-[11px] font-black uppercase tracking-[1.7px] text-[#2B8052]">
              SOLO STORE
            </Text>
            <Text className="mt-2 text-[32px] font-black tracking-tight text-[#17251D]">
              Reward yourself.
            </Text>
            <Text className="mt-2 max-w-[440px] text-sm leading-5 text-[#7B857D]">
              Redeem your points for useful products and everyday essentials.
            </Text>

            <View className="mt-5 rounded-2xl border border-[#DDE7DC] bg-[#174D35] p-4">
              <Text className="text-xs font-bold text-white/65">YOUR POINTS</Text>
              <View className="mt-1 flex-row items-end justify-between">
                <Text className="text-2xl font-black text-white">
                  {user?.points.toLocaleString("en-IN") ?? "0"} pts
                </Text>
                <Link href="/wallet" className="text-xs font-extrabold text-[#F7D77C]">
                  Wallet activity →
                </Link>
              </View>
            </View>

            <View className="mt-7 flex-row items-end justify-between">
              <View>
                <Text className="text-xl font-black text-[#17251D]">Available rewards</Text>
                <Text className="mt-1 text-xs text-[#7B857D]">
                  Reward requests are reviewed before fulfilment.
                </Text>
              </View>
              {!loading && !error && (
                <Text className="text-[10px] font-black tracking-wider text-[#849087]">
                  {products.length} ITEMS
                </Text>
              )}
            </View>

            {loading ? (
              <View className="mt-4 items-center rounded-2xl border border-[#E5E9E2] bg-white p-8">
                <Text className="text-sm font-bold text-[#287A4B]">Loading rewards…</Text>
              </View>
            ) : error ? (
              <View className="mt-4 rounded-2xl border border-[#E5E9E2] bg-white p-5">
                <Text className="font-bold text-[#8D3E2A]">{error}</Text>
                <Pressable onPress={() => void loadProducts()} className="mt-4 rounded-xl bg-[#174D35] p-3">
                  <Text className="text-center font-extrabold text-white">Try again</Text>
                </Pressable>
              </View>
            ) : (
              <View className="mt-4 flex-row flex-wrap justify-between gap-y-4">
                {products.map((product) => {
                  const canAfford = (user?.points ?? 0) >= product.points;
                  return (
                    <View key={product.id} className="w-[48%] overflow-hidden rounded-[22px] border border-[#E2E7DF] bg-white">
                      <View className="relative h-[150px] bg-[#EEF0EB]">
                        <Image
                          source={{ uri: product.image }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                          transition={200}
                        />
                        <View className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1">
                          <Text className="text-[9px] font-black tracking-wider text-[#287A4B]">{product.tag}</Text>
                        </View>
                      </View>
                      <View className="p-3.5">
                        <Text className="text-[9px] font-black tracking-[1.2px] text-[#849087]">{product.brand}</Text>
                        <Text className="mt-1 min-h-[40px] text-sm font-extrabold leading-5 text-[#17251D]">
                          {product.name}
                        </Text>
                        <View className="mt-3 flex-row items-center justify-between">
                          <View>
                            <Text className="text-[15px] font-black text-[#174D35]">
                              {product.points.toLocaleString("en-IN")}
                            </Text>
                            <Text className="text-[9px] font-bold text-[#849087]">POINTS</Text>
                          </View>
                          {canAfford ? (
                            <Link href={{ pathname: "/redeem", params: { id: product.id } }} asChild>
                              <Pressable className="items-center justify-center rounded-xl bg-[#174D35] px-3 py-2.5">
                                <Text className="text-xs font-extrabold text-white">Redeem</Text>
                              </Pressable>
                            </Link>
                          ) : (
                            <View className="items-center justify-center rounded-xl bg-[#EEF0EB] px-3 py-2.5">
                              <Text className="text-[10px] font-extrabold text-[#7B857D]">
                                Need {(product.points - (user?.points ?? 0)).toLocaleString("en-IN")} more
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View className="mt-6 rounded-2xl bg-[#FFF6E5] p-4">
              <Text className="text-sm font-extrabold text-[#745A22]">Need more points?</Text>
              <Text className="mt-1 text-xs leading-5 text-[#816D42]">
                Complete quizzes and daily check-ins. There are no ads to watch.
              </Text>
              <Link href="/learn" className="mt-3 text-sm font-black text-[#745A22]">
                Start learning →
              </Link>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
