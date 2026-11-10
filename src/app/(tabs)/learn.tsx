import { useCallback, useEffect, useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import PointsHeader from "@/components/points-header";
import { Question, useSolearn } from "@/context/solearn-context";

type AnswerResult = {
  correct: boolean;
  pointsAwarded: number;
  alreadyCompleted?: boolean;
};

export default function LearnScreen() {
  const { request, refreshUser } = useSolearn();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await request<{ questions: Question[] }>("/questions");
      setQuestions(result.questions);
      setQuestionIndex(0);
      setSelectedAnswer(null);
      setAnswerResult(null);
      setIsComplete(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load questions.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    let active = true;
    const fetchQuestions = async () => {
      try {
        const result = await request<{ questions: Question[] }>("/questions");
        if (!active) return;
        setQuestions(result.questions);
        setQuestionIndex(0);
        setSelectedAnswer(null);
        setAnswerResult(null);
        setIsComplete(false);
      } catch (requestError) {
        if (active) setError(requestError instanceof Error ? requestError.message : "Could not load questions.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void fetchQuestions();
    return () => {
      active = false;
    };
  }, [request]);

  const currentQuestion = questions[questionIndex];

  const answer = async (choice: string) => {
    if (!currentQuestion || selectedAnswer || saving) return;
    setSelectedAnswer(choice);
    setSaving(true);
    setError(null);
    try {
      const result = await request<AnswerResult>(`/questions/${currentQuestion.id}/answer`, {
        method: "POST",
        body: { answer: choice },
      });
      setAnswerResult(result);
      if (result.correct) await refreshUser();
    } catch (requestError) {
      setSelectedAnswer(null);
      setError(requestError instanceof Error ? requestError.message : "Could not save your answer.");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (!answerResult) return;
    if (!answerResult.correct) {
      setSelectedAnswer(null);
      setAnswerResult(null);
    } else if (questionIndex === questions.length - 1) {
      setIsComplete(true);
    } else {
      setQuestionIndex((index) => index + 1);
      setSelectedAnswer(null);
      setAnswerResult(null);
    }
  };

  return (
    <View className="flex-1 bg-[#F6F7F2]">
      <SafeAreaView className="flex-1" edges={["top"]}>
        <PointsHeader />
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="mx-auto w-full max-w-[720px] px-5 pt-5">
            <Link href="/" className="text-sm font-bold text-[#2B8052]">
              ← Back to home
            </Link>
            <Text className="mt-5 text-xs font-bold uppercase tracking-[1.5px] text-[#7B857D]">
              LEARN & EARN
            </Text>
            <Text className="mt-1 text-[30px] font-black text-[#17251D]">
              Knowledge pays.
            </Text>
            <Text className="mt-2 text-sm leading-5 text-[#7B857D]">
              Answer questions, learn something new, and earn points for correct answers.
            </Text>

            {loading ? (
              <View className="mt-6 items-center rounded-3xl border border-[#E5E9E2] bg-white p-8">
                <Text className="text-sm font-bold text-[#287A4B]">Loading your questions…</Text>
              </View>
            ) : error && questions.length === 0 ? (
              <View className="mt-6 rounded-3xl border border-[#E5E9E2] bg-white p-5">
                <Text className="font-bold text-[#8D3E2A]">{error}</Text>
                <Pressable onPress={() => void loadQuestions()} className="mt-4 rounded-xl bg-[#174D35] p-3">
                  <Text className="text-center font-extrabold text-white">Try again</Text>
                </Pressable>
              </View>
            ) : isComplete ? (
              <View className="mt-6 items-center rounded-3xl border border-[#E5E9E2] bg-white p-7">
                <Text className="text-5xl">🏆</Text>
                <Text className="mt-4 text-2xl font-black text-[#17251D]">
                  Challenge complete!
                </Text>
                <Text className="mt-2 text-center text-sm text-[#7B857D]">
                  Your correct answers have been saved to your account.
                </Text>
                <Pressable onPress={() => void loadQuestions()} className="mt-6 rounded-xl bg-[#287A4B] px-6 py-3">
                  <Text className="font-extrabold text-white">Review questions</Text>
                </Pressable>
              </View>
            ) : currentQuestion ? (
              <>
                <View className="mt-6 rounded-2xl bg-[#174D35] p-4">
                  <View className="flex-row justify-between">
                    <Text className="text-sm font-bold text-white/75">TODAY’S QUIZ</Text>
                    <Text className="text-sm font-extrabold text-[#F7D77C]">
                      +{currentQuestion.points} points / answer
                    </Text>
                  </View>
                  <View className="mt-4 h-2 rounded-full bg-white/15">
                    <View
                      className="h-2 rounded-full bg-[#F4C85E]"
                      style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }}
                    />
                  </View>
                  <Text className="mt-2 text-xs font-semibold text-white/70">
                    Question {questionIndex + 1} of {questions.length}
                  </Text>
                </View>

                <View className="mt-6 rounded-3xl border border-[#E5E9E2] bg-white p-5">
                  <View className="self-start rounded-full bg-[#EAF3EC] px-3 py-1.5">
                    <Text className="text-[11px] font-black tracking-wider text-[#287A4B]">
                      {currentQuestion.subject.toUpperCase()}
                    </Text>
                  </View>
                  <Text className="mt-5 text-[22px] font-black leading-8 text-[#17251D]">
                    {currentQuestion.prompt}
                  </Text>
                  <View className="mt-5 gap-3">
                    {currentQuestion.options.map((option, answerIndex) => {
                      const isSelected = selectedAnswer === option;
                      return (
                        <Pressable
                          key={option}
                          disabled={selectedAnswer !== null || saving}
                          onPress={() => void answer(option)}
                          className={`flex-row items-center rounded-xl border p-4 ${
                            isSelected
                              ? answerResult?.correct
                                ? "border-[#287A4B] bg-[#EDF7F0]"
                                : "border-[#D97757] bg-[#FFF1EC]"
                              : "border-[#E4E8E1] bg-white"
                          }`}
                        >
                          <View className={`mr-3 h-8 w-8 items-center justify-center rounded-full ${isSelected ? "bg-[#287A4B]" : "bg-[#F0F2ED]"}`}>
                            <Text className={`text-xs font-black ${isSelected ? "text-white" : "text-[#536057]"}`}>
                              {String.fromCharCode(65 + answerIndex)}
                            </Text>
                          </View>
                          <Text className="flex-1 text-sm font-bold text-[#26352B]">{option}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {saving && <Text className="mt-4 text-sm font-semibold text-[#7B857D]">Checking your answer…</Text>}
                  {error && <Text className="mt-4 text-sm font-semibold text-[#B34B36]">{error}</Text>}
                  {answerResult && (
                    <View className="mt-5 rounded-xl bg-[#F5F7F2] p-3">
                      <Text className="text-sm font-bold text-[#26352B]">
                        {answerResult.correct
                          ? answerResult.pointsAwarded > 0
                            ? `Correct — +${answerResult.pointsAwarded} points!`
                            : "Correct — you already earned points for this question."
                          : "Not quite. Try another answer."}
                      </Text>
                    </View>
                  )}
                  {answerResult && (
                    <Pressable onPress={next} className="mt-5 items-center rounded-xl bg-[#174D35] py-4">
                      <Text className="font-extrabold text-white">
                        {answerResult.correct
                          ? questionIndex === questions.length - 1
                            ? "Finish challenge"
                            : "Next question"
                          : "Try again"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : (
              <View className="mt-6 rounded-3xl border border-[#E5E9E2] bg-white p-5">
                <Text className="font-bold text-[#17251D]">No questions are available right now.</Text>
              </View>
            )}

            <View className="mt-5 rounded-2xl bg-[#FFF3D8] p-4">
              <Text className="font-extrabold text-[#745A22]">Earn without ads</Text>
              <Text className="mt-1 text-xs leading-5 text-[#816D42]">
                Points come from learning and daily check-ins. Ads are not shown or needed.
              </Text>
              <Link href="/rewards" className="mt-3 text-sm font-black text-[#745A22]">
                Explore daily rewards →
              </Link>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
