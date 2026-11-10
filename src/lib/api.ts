/**
 * Thin client for the SoLearn backend (see /backend).
 * Every screen talks to the API through this file, so URLs, headers and
 * error handling live in one place.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// ---------- Types (mirror the backend responses) ----------

export type User = {
  id: number;
  name: string;
  email: string;
  referralCode: string;
  points: number;
  streak: number;
  claimedToday: boolean;
  // Only returned by GET /me
  lifetimeEarned?: number;
  withdrawn?: number;
};

export type Question = {
  id: string;
  subject: string;
  prompt: string;
  options: string[];
};

export type AnswerResult = {
  correct: boolean;
  pointsAwarded: number;
  alreadyCompleted?: boolean;
};

type AuthResponse = { token: string; user: User };

// ---------- Errors ----------

/** An error with a message that is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// ---------- Token (set by the auth provider) ----------

let authToken: string | null = null;
export const setAuthToken = (token: string | null) => {
  authToken = token;
};

// ---------- Core request helper ----------

async function request<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error ?? 'Something went wrong. Please try again.', response.status);
  }
  return data as T;
}

// ---------- Endpoints ----------

export const api = {
  register: (input: { name: string; email: string; password: string; referralCode?: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: input }),

  login: (input: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: input }),

  me: () => request<{ user: User }>('/me'),

  questions: () => request<{ questions: Question[] }>('/questions'),

  answerQuestion: (id: string, answer: string) =>
    request<AnswerResult>(`/questions/${id}/answer`, { method: 'POST', body: { answer } }),

  claimDaily: () => request<{ pointsAwarded: number; streak: number }>('/rewards/daily', { method: 'POST' }),

  withdraw: (input: { points: number; method: string; details: string }) =>
    request<{ status: string }>('/withdrawals', { method: 'POST', body: input }),
};
