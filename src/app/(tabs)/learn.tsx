import { useEffect, useState } from 'react';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PointsHeader from '@/components/points-header';
import { api, ApiError, type AnswerResult, type Question } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

export default function LearnScreen() {
  const { refreshUser } = useAuth();

  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [earned, setEarned] = useState(0);
  const [done, setDone] = useState(false);

  // Bumping this number re-runs the fetch below (used to start over).
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false; // Ignore the response if the screen closes first.
    api
      .questions()
      .then(({ questions: list }) => {
        if (!cancelled) setQuestions(list);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof ApiError ? e.message : 'Could not load questions.');
      });
    return () => {
      cancelled = true;
    };
  }, [round]);

  // Start over (used by "Try again" and "Play again").
  const load = () => {
    setLoadError(null);
    setQuestions(null);
    setIndex(0);
    setPick(null);
    setResult(null);
    setEarned(0);
    setDone(false);
    setRound((r) => r + 1);
  };

  const question = questions?.[index];
  const isLast = questions ? index === questions.length - 1 : false;

  // Send the answer to the server, which decides if it is right and awards points.
  const choose = async (option: string) => {
    if (!question || pick || submitting) return;
    setPick(option);
    setSubmitting(true);
    try {
      const outcome = await api.answerQuestion(question.id, option);
      setResult(outcome);
      setEarned((total) => total + outcome.pointsAwarded);
      if (outcome.pointsAwarded > 0) refreshUser(); // Keep the points header up to date.
    } catch (e) {
      setPick(null); // Let the user try again.
      setLoadError(e instanceof ApiError ? e.message : 'Could not submit your answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const next = () => {
    if (!result) return;
    if (isLast) return setDone(true);
    setIndex((i) => i + 1);
    setPick(null);
    setResult(null);
  };

  const feedback = !result
    ? null
    : result.correct
      ? result.alreadyCompleted
        ? 'Correct — you already earned points for this one.'
        : `Correct answer — +${result.pointsAwarded} points!`
      : 'Not quite. Keep going!';

  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1" edges={['top']}>
        <PointsHeader />
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="mx-auto w-full max-w-[720px] px-5 pt-5">
            <Link href="/" className="text-sm font-bold text-[#2B8052]">← Back to home</Link>
            <Text className="mt-5 text-xs font-bold uppercase tracking-[1.5px] text-[#7B857D]">LEARN & EARN</Text>
            <Text className="mt-1 text-[30px] font-black text-[#17251D]">Knowledge pays.</Text>
            <Text className="mt-2 text-sm leading-5 text-[#7B857D]">Answer bite-sized questions and collect points as you learn.</Text>

            {!questions && !loadError && <ActivityIndicator className="mt-10" color="#287A4B" />}

            {loadError && (
              <View className="mt-6 rounded-2xl bg-[#FFF1EC] p-4">
                <Text className="text-sm font-bold text-[#A44A2B]">{loadError}</Text>
                <Pressable onPress={load} className="mt-3 self-start rounded-xl bg-[#174D35] px-4 py-2.5">
                  <Text className="text-xs font-extrabold text-white">Try again</Text>
                </Pressable>
              </View>
            )}

            {questions && (
              <>
                <View className="mt-6 rounded-2xl bg-[#174D35] p-4">
                  <View className="flex-row justify-between">
                    <Text className="text-sm font-bold text-white/75">TODAY’S QUIZ</Text>
                    <Text className="text-sm font-extrabold text-[#F7D77C]">Earn points per answer</Text>
                  </View>
                  <View className="mt-4 h-2 rounded-full bg-white/15">
                    <View className="h-2 rounded-full bg-[#F4C85E]" style={{ width: `${done ? 100 : ((index + 1) / questions.length) * 100}%` }} />
                  </View>
                  <Text className="mt-2 text-xs font-semibold text-white/70">
                    {done ? 'Completed' : `Question ${index + 1} of ${questions.length}`}
                  </Text>
                </View>

                {done ? (
                  <View className="mt-6 items-center rounded-3xl border border-[#E5E9E2] bg-white p-7">
                    <Text className="text-5xl">🏆</Text>
                    <Text className="mt-4 text-2xl font-black text-[#17251D]">Challenge complete!</Text>
                    <Text className="mt-2 text-sm text-[#7B857D]">You earned {earned} points this round.</Text>
                    <Pressable onPress={load} className="mt-6 rounded-xl bg-[#287A4B] px-6 py-3">
                      <Text className="font-extrabold text-white">Play again</Text>
                    </Pressable>
                  </View>
                ) : (
                  question && (
                    <View className="mt-6 rounded-3xl border border-[#E5E9E2] bg-white p-5">
                      <View className="self-start rounded-full bg-[#EAF3EC] px-3 py-1.5">
                        <Text className="text-[11px] font-black uppercase tracking-wider text-[#287A4B]">{question.subject}</Text>
                      </View>
                      <Text className="mt-5 text-[22px] font-black leading-8 text-[#17251D]">{question.prompt}</Text>

                      <View className="mt-5 gap-3">
                        {question.options.map((option, n) => {
                          const active = pick === option;
                          const good = active && result?.correct;
                          const bad = active && result && !result.correct;
                          return (
                            <Pressable
                              key={option}
                              disabled={!!pick}
                              onPress={() => choose(option)}
                              className={`flex-row items-center rounded-xl border p-4 ${
                                good ? 'border-[#287A4B] bg-[#EDF7F0]' : bad ? 'border-[#D97757] bg-[#FFF1EC]' : 'border-[#E4E8E1] bg-white'
                              }`}>
                              <View className={`mr-3 h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-[#287A4B]' : 'bg-[#F0F2ED]'}`}>
                                <Text className={`text-xs font-black ${active ? 'text-white' : 'text-[#536057]'}`}>{String.fromCharCode(65 + n)}</Text>
                              </View>
                              <Text className="flex-1 text-sm font-bold text-[#26352B]">{option}</Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {feedback && (
                        <View className="mt-5 rounded-xl bg-[#F5F7F2] p-3">
                          <Text className="text-sm font-bold text-[#26352B]">{feedback}</Text>
                        </View>
                      )}

                      <Pressable onPress={next} disabled={!result} className={`mt-5 items-center rounded-xl py-4 ${result ? 'bg-[#174D35]' : 'bg-[#DDE4DC]'}`}>
                        <Text className="font-extrabold text-white">{isLast ? 'Finish challenge' : 'Next question'}</Text>
                      </Pressable>
                    </View>
                  )
                )}
              </>
            )}

            <View className="mt-5 rounded-2xl bg-[#FFF3D8] p-4">
              <Text className="font-extrabold text-[#745A22]">More ways to earn</Text>
              <Text className="mt-1 text-xs leading-5 text-[#816D42]">Daily check-ins, reward videos and lucky spins live in the Rewards area.</Text>
              <Link href="/rewards" className="mt-3 text-sm font-black text-[#745A22]">Explore rewards →</Link>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
