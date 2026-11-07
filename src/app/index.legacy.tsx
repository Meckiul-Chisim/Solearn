import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';

type Question = {
  id: string;
  subject: string;
  prompt: string;
  options: string[];
};

type User = {
  points: number;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL
  ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000');
const ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

export default function HomeScreen() {
  const [user, setUser] = useState<User>();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [message, setMessage] = useState('Connecting to SoLearn...');
  const [token, setToken] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<string>();
  const [answerState, setAnswerState] = useState<'correct' | 'incorrect'>();

  useEffect(() => {
    let active = true;
    const email = `student${Date.now()}@example.com`;

    const connect = async () => {
      try {
        const accountResponse = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Student',
            email,
            password: `Demo-${Date.now()}!`,
          }),
        });
        const account = await accountResponse.json();
        if (!accountResponse.ok) throw new Error(account.error ?? 'Registration failed.');

        const questionsResponse = await fetch(`${API_URL}/questions`, {
          headers: { Authorization: `Bearer ${account.token}` },
        });
        const data = await questionsResponse.json();
        if (!questionsResponse.ok) throw new Error(data.error ?? 'Could not load questions.');

        if (!active) return;
        setToken(account.token);
        setUser(account.user);
        setQuestions(data.questions);
        setMessage('Choose the correct answer');
      } catch (error) {
        if (active) {
          setMessage(error instanceof Error ? error.message : 'Could not connect to the server.');
        }
      }
    };

    connect();
    return () => {
      active = false;
    };
  }, []);

  const answerQuestion = async (answer: string) => {
    const question = questions[questionIndex];
    if (!question || !token || selectedAnswer) return;

    setSelectedAnswer(answer);
    try {
      const response = await fetch(`${API_URL}/questions/${question.id}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ answer }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not save answer.');

      setAnswerState(result.correct ? 'correct' : 'incorrect');
      if (result.correct && result.pointsAwarded) {
        setUser((current) => current
          ? { points: current.points + result.pointsAwarded }
          : current);
        setMessage(`Correct! +${result.pointsAwarded} points`);
      } else if (result.correct) {
        setMessage('You already solved this question.');
      } else {
        setMessage('Not quite. Try another answer.');
      }
    } catch (error) {
      setAnswerState('incorrect');
      setMessage(error instanceof Error ? error.message : 'Could not save answer.');
    }
  };

  const continueQuiz = () => {
    if (answerState !== 'correct') {
      setSelectedAnswer(undefined);
      setAnswerState(undefined);
      setMessage('Choose the correct answer');
      return;
    }

    if (questionIndex < questions.length - 1) {
      setQuestionIndex((current) => current + 1);
      setSelectedAnswer(undefined);
      setAnswerState(undefined);
      setMessage('Choose the correct answer');
    } else {
      setMessage('Session complete. Great work!');
    }
  };

  const question = questions[questionIndex];
  const progress = questions.length ? ((questionIndex + 1) / questions.length) * 100 : 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <View>
              <ThemedText type="smallBold" themeColor="textSecondary">DAILY CHALLENGE</ThemedText>
              <ThemedText type="title" style={styles.heading}>Keep learning.</ThemedText>
            </View>
            <ThemedView type="backgroundSelected" style={styles.points}>
              <View style={styles.coin} />
              <ThemedText type="smallBold">{user?.points ?? 0}</ThemedText>
            </ThemedView>
          </View>

          {questions.length > 0 && (
            <View style={styles.progressSection}>
              <View style={styles.progressLabels}>
                <ThemedText type="smallBold">Today’s lesson</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {questionIndex + 1} of {questions.length}
                </ThemedText>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </View>
          )}

          {question ? (
            <View style={styles.quizCard}>
              <View style={styles.subjectRow}>
                <ThemedView type="backgroundSelected" style={styles.subjectBadge}>
                  <ThemedText type="smallBold">{question.subject}</ThemedText>
                </ThemedView>
                <ThemedText type="smallBold" themeColor="textSecondary">10 pts</ThemedText>
              </View>

              <ThemedText type="subtitle" style={styles.question}>{question.prompt}</ThemedText>

              <View style={styles.answers}>
                {question.options.map((option, index) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrect = isSelected && answerState === 'correct';
                  const isIncorrect = isSelected && answerState === 'incorrect';
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      disabled={Boolean(selectedAnswer)}
                      onPress={() => answerQuestion(option)}
                      style={({ pressed }) => [
                        styles.answer,
                        isSelected && styles.selectedAnswer,
                        isCorrect && styles.correctAnswer,
                        isIncorrect && styles.incorrectAnswer,
                        pressed && !selectedAnswer && styles.pressed,
                      ]}>
                      <View style={[
                        styles.answerLetter,
                        isCorrect && styles.correctLetter,
                        isIncorrect && styles.incorrectLetter,
                      ]}>
                        <ThemedText type="smallBold" style={isCorrect || isIncorrect ? styles.lightLetter : undefined}>
                          {ANSWER_LETTERS[index] ?? index + 1}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.answerText}>{option}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.footer}>
                <ThemedText
                  type="small"
                  themeColor={answerState === 'correct' ? undefined : 'textSecondary'}
                  style={answerState === 'correct' ? styles.successMessage : undefined}>
                  {message}
                </ThemedText>
                {selectedAnswer && (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.continueButton}
                    onPress={continueQuiz}>
                    <ThemedText type="smallBold" style={styles.continueLabel}>
                      {answerState === 'correct'
                        ? (questionIndex < questions.length - 1 ? 'Continue' : 'Finish')
                        : 'Try again'}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          ) : (
            <ThemedView type="backgroundElement" style={styles.loadingCard}>
              <View style={styles.loadingMark} />
              <ThemedText type="subtitle" style={styles.loadingTitle}>Preparing your lesson</ThemedText>
              <ThemedText themeColor="textSecondary">{message}</ThemedText>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingBottom: BottomTabInset + Spacing.three,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  heading: {
    fontSize: 40,
    lineHeight: 46,
    marginTop: Spacing.one,
  },
  points: {
    minWidth: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  coin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#F4B942',
  },
  progressSection: {
    gap: Spacing.two,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: '#DCE0DF',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E8B57',
  },
  quizCard: {
    gap: Spacing.four,
    borderWidth: 1,
    borderColor: '#E1E3E2',
    borderRadius: 8,
    padding: Spacing.four,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectBadge: {
    borderRadius: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  question: {
    fontSize: 30,
    lineHeight: 38,
  },
  answers: {
    gap: Spacing.two,
  },
  answer: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D7DAD8',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  selectedAnswer: {
    borderColor: '#F0A64A',
    borderWidth: 2,
  },
  correctAnswer: {
    borderColor: '#2E8B57',
    backgroundColor: '#EDF7F1',
  },
  incorrectAnswer: {
    borderColor: '#E65D4A',
    backgroundColor: '#FFF0ED',
  },
  pressed: {
    opacity: 0.72,
  },
  answerLetter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF0EF',
  },
  correctLetter: {
    backgroundColor: '#2E8B57',
  },
  incorrectLetter: {
    backgroundColor: '#E65D4A',
  },
  lightLetter: {
    color: '#FFFFFF',
  },
  answerText: {
    flex: 1,
  },
  footer: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  successMessage: {
    color: '#217A4A',
  },
  continueButton: {
    minWidth: 112,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#E65D4A',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  continueLabel: {
    color: '#FFFFFF',
  },
  loadingCard: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: Spacing.two,
    padding: Spacing.four,
  },
  loadingMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F4B942',
    marginBottom: Spacing.two,
  },
  loadingTitle: {
    fontSize: 26,
    lineHeight: 34,
  },
});
