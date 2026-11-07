import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { BottomTabInset } from '@/constants/theme';

const questions = [
  {
    subject: 'BIOLOGY',
    prompt: 'Which process do plants use to turn sunlight into food?',
    options: ['Photosynthesis', 'Condensation', 'Evaporation', 'Combustion'],
    answer: 'Photosynthesis',
  },
  {
    subject: 'GEOGRAPHY',
    prompt: 'Which ocean is the largest on Earth?',
    options: ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean'],
    answer: 'Pacific Ocean',
  },
  {
    subject: 'MATHEMATICS',
    prompt: 'What is the value of 8 multiplied by 7?',
    options: ['48', '54', '56', '64'],
    answer: '56',
  },
];

export default function HomeScreen() {
  const [selected, setSelected] = useState<string>();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  const chooseAnswer = async (answer: string) => {
    setSelected(answer);
    await Haptics.selectionAsync();
  };

  const continueLesson = () => {
    if (selected !== question.answer) {
      setSelected(undefined);
      return;
    }

    if (questionIndex < questions.length - 1) {
      setQuestionIndex((current) => current + 1);
      setSelected(undefined);
      return;
    }

    setCompleted(true);
  };

  const question = questions[questionIndex];

  return (
    <View className="flex-1 bg-[#F4F1E8]">
      <SafeAreaView className="flex-1" edges={["top"]}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: BottomTabInset + 32 }}
          showsVerticalScrollIndicator={false}>
          <View className="w-full max-w-[760px] self-center px-5 pb-8 pt-5">
            <View className="flex-row items-start justify-between">
              <View>
                <Text className="text-xs font-bold uppercase tracking-[1px] text-[#6F766F]">Monday, Nov 6</Text>
                <Text className="mt-1 font-sans text-[38px] font-extrabold leading-[43px] text-[#17211B]">Good morning,</Text>
                <Text className="font-sans text-[38px] font-extrabold leading-[43px] text-[#287A4B]">Alex.</Text>
              </View>
              <Pressable className="h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm" accessibilityRole="button">
                <Text className="text-[22px]">🎁</Text>
              </Pressable>
            </View>

            <LinearGradient
              colors={['#287A4B', '#1E633C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 8, marginTop: 24, padding: 20 }}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-sm font-bold text-white/75">YOUR STREAK</Text>
                  <View className="mt-1 flex-row items-center gap-2">
                    <Text className="text-[28px]">🔥</Text>
                    <Text className="text-[34px] font-black text-white">12 days</Text>
                  </View>
                </View>
                <View className="h-[64px] w-[64px] items-center justify-center rounded-full border border-white/20 bg-white/10">
                  <Text className="text-[28px] text-[#F2B84B]">★</Text>
                </View>
              </View>
              <View className="mt-5 h-1.5 overflow-hidden rounded-full bg-black/20">
                <View className="h-full w-[68%] rounded-full bg-[#F2B84B]" />
              </View>
              <Text className="mt-2 text-xs font-semibold text-white/80">680 of 1,000 points this week</Text>
            </LinearGradient>

            <View className="mt-7 flex-row items-end justify-between">
              <View>
                <Text className="text-[26px] font-extrabold text-[#17211B]">Today’s lesson</Text>
                <Text className="mt-1 text-sm font-medium text-[#777C76]">One question can change your day.</Text>
              </View>
              <View className="mb-1 rounded-full bg-[#F0DCA1] px-3 py-1.5">
                <Text className="text-xs font-bold text-[#775A18]">+10 XP</Text>
              </View>
            </View>

            <View className="mt-4 rounded-lg border border-[#DDD9CD] bg-white p-5">
              <View className="flex-row items-center justify-between">
                <View className="rounded-md bg-[#EAF3EC] px-3 py-1.5">
                  <Text className="text-xs font-bold text-[#287A4B]">{question.subject}</Text>
                </View>
                <Text className="text-xs font-bold text-[#8A8E88]">Question {questionIndex + 1} of {questions.length}</Text>
              </View>

              <Text className="mt-5 text-[29px] font-extrabold leading-[36px] text-[#17211B]">
                {question.prompt}
              </Text>

              <View className="mt-6 gap-3">
                {question.options.map((option, index) => {
                  const isSelected = selected === option;
                  const isCorrect = isSelected && option === question.answer;
                  const isWrong = isSelected && option !== question.answer;
                  return (
                    <Pressable
                      key={option}
                      disabled={Boolean(selected)}
                      onPress={() => chooseAnswer(option)}
                      className={`min-h-[58px] flex-row items-center rounded-lg border px-4 py-3 ${
                        isCorrect ? 'border-[#287A4B] bg-[#EDF7F1]' :
                        isWrong ? 'border-[#E7654D] bg-[#FFF1ED]' :
                        'border-[#D9D9D2] bg-white'
                      }`}>
                      <View className={`mr-3 h-8 w-8 items-center justify-center rounded-full ${
                        isCorrect ? 'bg-[#287A4B]' : isWrong ? 'bg-[#E7654D]' : 'bg-[#EFF0ED]'
                      }`}>
                        <Text className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-[#17211B]'}`}>
                          {String.fromCharCode(65 + index)}
                        </Text>
                      </View>
                      <Text className="flex-1 text-base font-semibold text-[#17211B]">{option}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {selected && (
                <View className="mt-5 flex-row items-center justify-between gap-3 border-t border-[#E7E7E1] pt-4">
                  <View className="flex-1 flex-row items-center gap-2">
                    <Text className={`text-lg ${selected === question.answer ? 'text-[#287A4B]' : 'text-[#E7654D]'}`}>
                      ✦
                    </Text>
                    <Text className="flex-1 text-sm font-bold text-[#17211B]">
                      {selected === question.answer ? 'Correct! +10 points' : 'Almost. Try again.'}
                    </Text>
                  </View>
                  <Pressable
                    className="rounded-lg bg-[#17211B] px-5 py-3"
                    onPress={continueLesson}>
                    <Text className="text-sm font-bold text-white">
                      {selected === question.answer
                        ? questionIndex === questions.length - 1 ? 'Finish' : 'Next'
                        : 'Retry'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {completed && (
                <View className="mt-5 rounded-lg bg-[#EDF7F1] p-4">
                  <Text className="text-lg font-extrabold text-[#287A4B]">Lesson complete!</Text>
                  <Text className="mt-1 text-sm font-medium text-[#566159]">You earned 30 points. Great work.</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
