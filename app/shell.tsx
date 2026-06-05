"use client";

import { useState } from "react";
import QuestionsList from "./questions-list";
import PollCard from "./poll-card";
import ThemeToggle from "./theme-toggle";
import type { Poll } from "@/lib/polls";

type Question = {
  id: string;
  body: string;
  author: string | null;
  votes: number;
  createdAt?: string | null;
};

type User = {
  username: string;
  email: string;
};

type Account = User & {
  password: string;
};

type FeedView = "Home" | "Popular" | "Explore" | "All" | "Saved" | "Hidden";
type AuthMode = "login" | "signup";

const ACCOUNTS_KEY = "kealvi_accounts";
const SESSION_KEY = "kealvi_session";
const JOINED_KEY = "kealvi_joined_communities";
const COMMUNITIES = ["kealvi", "nextjs", "supabase", "webdev"];
const TRENDING_TOPICS = [
  "Server Components",
  "Supabase RLS",
  "Optimistic UI",
  "Database indexing",
];

function readAccounts(): Account[] {
  if (typeof localStorage === "undefined") return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: Account[]) {
  if (typeof localStorage === "undefined") return;

  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function readJoinedCommunities() {
  if (typeof localStorage === "undefined") return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(JOINED_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function readSession(): User | null {
  if (typeof localStorage === "undefined") return null;

  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    return session?.username && session?.email ? session : null;
  } catch {
    return null;
  }
}

export default function RedditShell({
  initialQuestions,
  initialHasMore,
  initialPoll,
}: {
  initialQuestions: Question[];
  initialHasMore: boolean;
  initialPoll: Poll | null;
}) {
  const [user, setUser] = useState<User | null>(() => readSession());
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<FeedView>("Home");
  const [activeCommunity, setActiveCommunity] = useState("kealvi");
  const [globalQuery, setGlobalQuery] = useState("");
  const [createSignal, setCreateSignal] = useState(0);
  const [joinedCommunities, setJoinedCommunities] = useState<Set<string>>(
    () => new Set(readJoinedCommunities())
  );

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthOpen(true);
    setAuthError(null);
  }

  function closeAuth() {
    setAuthOpen(false);
    setAuthUsername("");
    setAuthEmail("");
    setAuthPassword("");
    setAuthError(null);
  }

  function submitAuth() {
    const username = authUsername.trim();
    const email = authEmail.trim().toLowerCase();
    const password = authPassword.trim();
    const accounts = readAccounts();

    if (authMode === "signup") {
      if (!username || !email || password.length < 4) {
        setAuthError("Username, email, and a 4+ character password are required.");
        return;
      }

      if (
        accounts.some(
          (account) => account.username === username || account.email === email
        )
      ) {
        setAuthError("That username or email is already registered.");
        return;
      }

      const nextUser = { username, email };
      saveAccounts([...accounts, { ...nextUser, password }]);
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
      setUser(nextUser);
      closeAuth();
      return;
    }

    const account = accounts.find(
      (item) =>
        (item.username === username || item.email === email || item.email === username) &&
        item.password === password
    );

    if (!account) {
      setAuthError("No matching account found.");
      return;
    }

    const nextUser = { username: account.username, email: account.email };
    localStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    closeAuth();
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }

  function requireAuth() {
    if (user) return true;
    openAuth("login");
    return false;
  }

  function toggleJoin(community = activeCommunity) {
    if (!requireAuth()) return;

    setJoinedCommunities((items) => {
      const next = new Set(items);
      if (next.has(community)) {
        next.delete(community);
      } else {
        next.add(community);
      }
      localStorage.setItem(JOINED_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function selectView(view: FeedView) {
    setActiveView(view);
    if (view === "Explore") setGlobalQuery("");
  }

  return (
    <main className="min-h-screen bg-[var(--reddit-bg)] text-[var(--reddit-text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--reddit-border)] bg-[var(--reddit-card)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-4">
          <button
            onClick={() => {
              selectView("Home");
              setGlobalQuery("");
            }}
            className="flex min-w-0 items-center gap-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--reddit-orange)] text-lg font-black text-white">
              r
            </span>
            <span className="hidden text-xl font-bold tracking-tight text-[var(--reddit-text)] sm:block">
              Kealvi
            </span>
          </button>
          <input
            value={globalQuery}
            onChange={(event) => setGlobalQuery(event.target.value)}
            placeholder={`Search ${activeCommunity}`}
            className="min-w-0 flex-1 rounded-full border border-[var(--reddit-border-soft)] bg-[var(--reddit-card-muted)] px-4 py-2 text-sm text-[var(--reddit-text)] outline-none placeholder:text-[var(--reddit-muted)] focus:border-[var(--reddit-blue)]"
          />
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={logout}
                className="hidden rounded-full border border-[var(--reddit-border)] px-4 py-1.5 text-sm font-bold text-[var(--reddit-text)] hover:border-[var(--reddit-hover)] sm:inline-flex"
              >
                {user.username}
              </button>
            </div>
          ) : (
            <button
              onClick={() => openAuth("login")}
              className="hidden rounded-full border border-[var(--reddit-blue)] px-4 py-1.5 text-sm font-bold text-[var(--reddit-blue)] hover:bg-[var(--reddit-blue)] hover:text-white sm:inline-flex"
            >
              Log In
            </button>
          )}
          <button
            onClick={() => {
              if (!requireAuth()) return;
              setCreateSignal((value) => value + 1);
            }}
            className="rounded-full bg-[var(--reddit-orange)] px-4 py-1.5 text-sm font-bold text-white hover:opacity-90"
          >
            Create
          </button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-3 py-4 sm:px-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="hidden lg:block">
          <nav className="sticky top-[4.5rem] space-y-2 rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)] p-3">
            {(["Home", "Popular", "Explore", "All", "Saved", "Hidden"] as FeedView[]).map(
              (item) => (
                <button
                  key={item}
                  onClick={() => selectView(item)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
                    activeView === item
                      ? "bg-[var(--reddit-card-muted)] text-[var(--reddit-orange)]"
                      : "text-[var(--reddit-text)] hover:bg-[var(--reddit-card-muted)]"
                  }`}
                >
                  {item}
                </button>
              )
            )}
            <div className="border-t border-[var(--reddit-border-soft)] pt-2">
              <p className="px-3 py-2 text-xs font-bold uppercase text-[var(--reddit-muted)]">
                Communities
              </p>
              {COMMUNITIES.map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setActiveCommunity(item);
                    selectView("Home");
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    activeCommunity === item
                      ? "bg-[var(--reddit-card-muted)] font-bold text-[var(--reddit-blue)]"
                      : "text-[var(--reddit-text)] hover:bg-[var(--reddit-card-muted)]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </nav>
        </aside>

        <QuestionsList
          initialQuestions={initialQuestions}
          initialHasMore={initialHasMore}
          currentUser={user}
          activeView={activeView}
          activeCommunity={activeCommunity}
          externalQuery={globalQuery}
          createSignal={createSignal}
          onRequireAuth={() => requireAuth()}
        />

        <aside className="space-y-4 lg:sticky lg:top-[4.5rem] lg:self-start">
          <section className="rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)]">
            <div className="rounded-t-md bg-[var(--reddit-orange)] px-4 py-3 text-sm font-bold text-white">
              About {activeCommunity}
            </div>
            <div className="space-y-3 p-4 text-sm">
              <p>
                A Reddit-style live Q&amp;A community for asking, voting, polling,
                saving, sharing, hiding, and discussing posts.
              </p>
              <div className="grid grid-cols-2 gap-3 border-y border-[var(--reddit-border-soft)] py-3">
                <div>
                  <p className="font-bold">{initialQuestions.length}</p>
                  <p className="text-xs text-[var(--reddit-muted)]">posts loaded</p>
                </div>
                <div>
                  <p className="font-bold">{joinedCommunities.size + 12}</p>
                  <p className="text-xs text-[var(--reddit-muted)]">members</p>
                </div>
              </div>
              <button
                onClick={() => toggleJoin()}
                className={`w-full rounded-full px-4 py-2 font-bold text-white hover:opacity-90 ${
                  joinedCommunities.has(activeCommunity)
                    ? "bg-[var(--reddit-muted)]"
                    : "bg-[var(--reddit-blue)]"
                }`}
              >
                {joinedCommunities.has(activeCommunity) ? "Joined" : "Join"}
              </button>
            </div>
          </section>

          <PollCard initialPoll={initialPoll} />

          <section className="rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)] p-4">
            <h2 className="mb-3 text-sm font-bold">Trending topics</h2>
            {TRENDING_TOPICS.map((topic, index) => (
              <button
                key={topic}
                onClick={() => setGlobalQuery(topic)}
                className="block w-full border-t border-[var(--reddit-border-soft)] py-3 text-left first:border-t-0 first:pt-0 hover:text-[var(--reddit-blue)]"
              >
                <p className="text-xs text-[var(--reddit-muted)]">
                  #{index + 1} in {activeCommunity}
                </p>
                <p className="font-medium">{topic}</p>
              </button>
            ))}
          </section>
        </aside>
      </div>

      {authOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 p-4">
          <section className="w-full max-w-md rounded-md border border-[var(--reddit-border)] bg-[var(--reddit-card)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                {authMode === "login" ? "Log in" : "Sign up"}
              </h2>
              <button
                onClick={closeAuth}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--reddit-card-muted)]"
                aria-label="Close auth modal"
              >
                x
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                placeholder={authMode === "login" ? "Username or email" : "Username"}
                className="w-full rounded-md border border-[var(--reddit-border-soft)] bg-[var(--reddit-card-muted)] px-3 py-2 outline-none focus:border-[var(--reddit-blue)]"
              />
              {authMode === "signup" && (
                <input
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  placeholder="Email"
                  type="email"
                  className="w-full rounded-md border border-[var(--reddit-border-soft)] bg-[var(--reddit-card-muted)] px-3 py-2 outline-none focus:border-[var(--reddit-blue)]"
                />
              )}
              <input
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Password"
                type="password"
                className="w-full rounded-md border border-[var(--reddit-border-soft)] bg-[var(--reddit-card-muted)] px-3 py-2 outline-none focus:border-[var(--reddit-blue)]"
              />
              {authError && (
                <p className="text-sm text-[var(--reddit-danger-text)]">
                  {authError}
                </p>
              )}
              <button
                onClick={submitAuth}
                className="w-full rounded-full bg-[var(--reddit-orange)] px-4 py-2 font-bold text-white hover:opacity-90"
              >
                {authMode === "login" ? "Log In" : "Sign Up"}
              </button>
              <button
                onClick={() => {
                  setAuthMode(authMode === "login" ? "signup" : "login");
                  setAuthError(null);
                }}
                className="w-full rounded-full border border-[var(--reddit-border)] px-4 py-2 text-sm font-bold hover:border-[var(--reddit-hover)]"
              >
                {authMode === "login"
                  ? "New here? Sign up"
                  : "Already have an account? Log in"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
