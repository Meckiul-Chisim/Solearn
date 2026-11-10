import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { useAuth } from '@/providers/auth-provider';

export default function PointsHeader() {
  const { user } = useAuth();

  return (
    <View className="mx-auto w-full max-w-[760px] flex-row items-center justify-between px-5 pt-3">
      <View>
        <Text className="text-[11px] font-black uppercase tracking-[1.6px] text-[#7B857D]">SOLOEARN</Text>
        <Text className="mt-0.5 text-xs font-medium text-[#7B857D]">Your points balance</Text>
      </View>
      <Link href="/wallet" className="rounded-2xl border border-[#DDE6DC] bg-white px-4 py-2.5">
        <Text className="text-[10px] font-extrabold uppercase tracking-wider text-[#718075]">AVAILABLE POINTS</Text>
        <Text className="mt-0.5 text-lg font-black text-[#174D35]">
          {(user?.points ?? 0).toLocaleString('en-IN')} <Text className="text-xs font-bold text-[#65806D]">PTS</Text>
        </Text>
      </Link>
    </View>
  );
}
