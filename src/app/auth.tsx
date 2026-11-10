import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSolearn } from "@/context/solearn-context";

export default function AuthScreen() {
  const { signIn, signUp, sessionError, retrySession } = useSolearn();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (isRegistering) {
        await signUp(name.trim(), email.trim(), password, referralCode.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not connect to SoloEarn.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingBottom: 32 }}>
            <View className="mx-auto w-full max-w-[500px] px-5 py-8">
              <View className="h-14 w-14 items-center justify-center rounded-2xl bg-[#174D35]">
                <Text className="text-2xl">✦</Text>
              </View>
              <Text className="mt-6 text-xs font-black uppercase tracking-[1.7px] text-[#2B8052]">
                SOLOEARN
              </Text>
              <Text className="mt-2 text-[32px] font-black text-[#17251D]">
                {isRegistering ? "Create your account." : "Welcome back."}
              </Text>
              <Text className="mt-2 text-sm leading-5 text-[#7B857D]">
                Learn, collect points, and redeem rewards. No ads.
              </Text>

              {sessionError && (
                <View className="mt-5 rounded-xl bg-[#FFF1EC] p-4">
                  <Text className="text-sm font-bold text-[#8D3E2A]">{sessionError}</Text>
                  <Pressable onPress={() => void retrySession()} className="mt-2">
                    <Text className="font-extrabold text-[#8D3E2A]">Try connecting again</Text>
                  </Pressable>
                </View>
              )}

              <View className="mt-6 gap-4 rounded-3xl border border-[#E5E9E2] bg-white p-5">
                {isRegistering && (
                  <View>
                    <Text className="mb-2 text-xs font-extrabold text-[#26352B]">Your name</Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      autoComplete="name"
                      placeholder="Alex Student"
                      className="rounded-xl border border-[#E5E9E2] bg-[#FAFBF8] px-4 py-3 text-sm text-[#17251D]"
                    />
                  </View>
                )}
                <View>
                  <Text className="mb-2 text-xs font-extrabold text-[#26352B]">Email address</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    placeholder="you@example.com"
                    className="rounded-xl border border-[#E5E9E2] bg-[#FAFBF8] px-4 py-3 text-sm text-[#17251D]"
                  />
                </View>
                <View>
                  <Text className="mb-2 text-xs font-extrabold text-[#26352B]">Password</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete={isRegistering ? "new-password" : "current-password"}
                    placeholder={isRegistering ? "At least 8 characters" : "Your password"}
                    className="rounded-xl border border-[#E5E9E2] bg-[#FAFBF8] px-4 py-3 text-sm text-[#17251D]"
                  />
                </View>
                {isRegistering && (
                  <View>
                    <Text className="mb-2 text-xs font-extrabold text-[#26352B]">Referral code (optional)</Text>
                    <TextInput
                      value={referralCode}
                      onChangeText={setReferralCode}
                      autoCapitalize="characters"
                      placeholder="Enter a friend's code"
                      className="rounded-xl border border-[#E5E9E2] bg-[#FAFBF8] px-4 py-3 text-sm text-[#17251D]"
                    />
                  </View>
                )}

                {error && <Text className="text-sm font-semibold text-[#B34B36]">{error}</Text>}

                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void submit()}
                  className={`items-center rounded-xl py-4 ${busy ? "bg-[#8DA396]" : "bg-[#174D35]"}`}
                >
                  <Text className="font-extrabold text-white">
                    {busy ? "Please wait…" : isRegistering ? "Create account" : "Sign in"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setIsRegistering((current) => !current);
                    setError(null);
                  }}
                  className="items-center py-2"
                >
                  <Text className="text-sm font-bold text-[#287A4B]">
                    {isRegistering ? "Already have an account? Sign in" : "New to SoloEarn? Create an account"}
                  </Text>
                </Pressable>
              </View>
              <Text className="mt-5 text-center text-xs leading-5 text-[#849087]">
                Your points and rewards are validated by the SoloEarn server.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
