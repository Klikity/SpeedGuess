import { useEffect, useMemo, useState } from "react";
import { answers, allowedWords } from "./words";
import { supabase } from "./supabase";
import "./App.css";

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;

const keyboardRows = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

const defaultClassicStats = {
  played: 0,
  wins: 0,
  attempts: [0, 0, 0, 0, 0, 0],
};

const defaultTimedStats = {
  played: 0,
  wins: 0,
  bestTime: null,
  totalTime: 0,
  totalGuesses: 0,
  totalPenalty: 0,
  cleanWins: 0,
};

const defaultStreakStats = {
  current: 0,
  longest: 0,

  lastCompletedDate: null,

  totalDailyCompletions: 0,

  streaksBroken: 0,

  reached3Days: false,
  reached7Days: false,
  reached14Days: false,
  reached30Days: false,
  reached100Days: false,
};

const defaultSpeedStats = {
  played: 0,
  wins: 0,
  bestTime: null,
  totalTime: 0,
  totalGuesses: 0,
  totalPenalty: 0,
  cleanWins: 0,
};

function getTodayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function getStartOfWeekKey() {
  const todayKey = getTodayKey();

  const [year, month, day] =
    todayKey.split("-").map(Number);

  const date = new Date(
    year,
    month - 1,
    day
  );

  // Convert Sunday=0 to Monday-based indexing.
  const daysSinceMonday =
    (date.getDay() + 6) % 7;

  date.setDate(
    date.getDate() - daysSinceMonday
  );

  return date.toLocaleDateString("en-CA");
}

function hashString(text) {
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function getDailyWordForDate(wordList, dateKey) {
  let h = 2166136261;

  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  h += h << 13;
  h ^= h >>> 7;
  h += h << 3;
  h ^= h >>> 17;
  h += h << 5;

  const randomNumber = (h >>> 0) / 4294967296;

  const index = Math.floor(randomNumber * wordList.length);

  return wordList[index].toLowerCase();
}

function getDailyWord(wordList) {
  return getDailyWordForDate(wordList, getTodayKey());
}

function addDaysToDateKey(dateKey, amount) {
  const [year, month, day] = dateKey.split("-").map(Number);

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);

  return date.toLocaleDateString("en-CA");
}

function formatDisplayDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString("en-UK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function getRandomWord() {
  return answers[Math.floor(Math.random() * answers.length)].toLowerCase();
}

function App() {
  const creatorAccess = useMemo(() => {
    const params = new URLSearchParams(window.location.search);

    return (
      params.get("creator") === "1" ||
      localStorage.getItem("quirdleCreatorAccess") === "true"
    );
  }, []);

  const [creatorMode, setCreatorMode] = useState(false);
  const [showCreatorPanel, setShowCreatorPanel] = useState(true);

  const [creatorDate, setCreatorDate] = useState(() =>
    addDaysToDateKey(getTodayKey(), 1)
  );

  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const [showNicknameModal, setShowNicknameModal] = useState(false);

  const [nickname, setNickname] = useState(
    () =>
      localStorage.getItem("nickname") || ""
  );

  const [creatorResult, setCreatorResult] = useState(null);

  const [mode, setMode] = useState(
    () => localStorage.getItem("currentMode") || "classic"
  );

  const [targetWord, setTargetWord] = useState(() => {
    const currentMode =
      localStorage.getItem("currentMode") || "classic";

    return currentMode === "speed"
      ? getDailyWord(answers)
      : getRandomWord();
  });
  
  const [guesses, setGuesses] = useState([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [message, setMessage] = useState("");

  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [finalTime, setFinalTime] = useState(null);

  const [showStats, setShowStats] = useState(false);
  const [classicStats, setClassicStats] = useState(() => {
    const saved = localStorage.getItem("classicStats");
    return saved ? JSON.parse(saved) : defaultClassicStats;
  });

  const [timedStats, setTimedStats] = useState(() => {
    const saved = localStorage.getItem("timedStats");
    return saved ? JSON.parse(saved) : defaultTimedStats;
  });

  const [speedStats, setSpeedStats] = useState(() => {
    const saved = localStorage.getItem("speedStats");
    return saved ? JSON.parse(saved) : defaultSpeedStats;
  });

  const [streakStats, setStreakStats] = useState(() => {
    const saved = localStorage.getItem("streakStats");
    return saved ? JSON.parse(saved) : defaultStreakStats;
  });

  const [pendingResult, setPendingResult] = useState(null);

  const [newPersonalBest, setNewPersonalBest] = useState(false);
  const [showDailyAchievement, setShowDailyAchievement] = useState(false);

  const [lastResult, setLastResult] = useState(() => {
    const saved = localStorage.getItem("lastResult");
    return saved ? JSON.parse(saved) : null;
  });

  const [dailyRank, setDailyRank] = useState(null);

  const allowedSet = useMemo(() => {
    const baseWords =
      allowedWords instanceof Set ? Array.from(allowedWords) : allowedWords;

    return new Set([...baseWords, ...answers].map((word) => word.toLowerCase()));
  }, []);

  const gameWon = guesses.includes(targetWord);

  const gameLost =
    mode === "classic" && guesses.length >= MAX_ATTEMPTS && !gameWon;

  const gameOver = gameWon || gameLost;

  const [showSpeedHelp, setShowSpeedHelp] = useState(() => {
    return !localStorage.getItem("speedHelpShown");
  });

  const [showDailyResult, setShowDailyResult] = useState(false);

  const [leaderboard, setLeaderboard] = useState([]);

  const [leaderboardPeriod, setLeaderboardPeriod] = useState("daily");

  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const [showAbout, setShowAbout] = useState(false);

  const playerId = useMemo(() => {
    let id = localStorage.getItem("playerId");
      if (!id) {
        id = crypto.randomUUID();

        localStorage.setItem(
          "playerId",
          id
        );
      }

      return id;
    }, []);

  
  const [savedGames, setSavedGames] = useState(() => {
    const saved = localStorage.getItem("savedGames");

    return saved
      ? JSON.parse(saved)
      : {
          classic: null,
          timed: null,
          speed: null,
        };
  });

  useEffect(() => {
    if (creatorAccess) {
      localStorage.setItem("quirdleCreatorAccess", "true");
    }
  }, [creatorAccess]);

  useEffect(() => {
    localStorage.setItem(
      "savedGames",
      JSON.stringify(savedGames)
    );
  }, [savedGames]);
  
  useEffect(() => {
    localStorage.setItem("timedStats", JSON.stringify(timedStats));
  }, [timedStats]);

  useEffect(() => {
    loadLeaderboard(leaderboardPeriod);
  }, [leaderboardPeriod]);

  useEffect(() => {
    localStorage.setItem(
      "nickname",
      nickname
    );
  }, [nickname]);

  useEffect(() => {
    if (creatorMode) return;

    setSavedGames(prev => ({
      ...prev,

      [mode]: {
        targetWord,
        guesses,
        currentGuess,
        elapsedTime:
            startTime
              ? Date.now() - startTime
              : elapsedTime,
        finalTime,
        message,
      }
    }));
  }, [
    creatorMode,
    mode,
    targetWord,
    guesses,
    currentGuess,
    elapsedTime,
    finalTime,
    message,
    startTime,
  ]);

  useEffect(() => {
    if (
      lastResult &&
      lastResult.date !== getTodayKey()
    ) {
      setLastResult(null);
      
      setGuesses([]); 
      setFinalTime(null);
      setElapsedTime(0);

      localStorage.removeItem("lastResult");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("classicStats", JSON.stringify(classicStats));
  }, [classicStats]);

  useEffect(() => {
    localStorage.setItem("speedStats", JSON.stringify(speedStats));
  }, [speedStats]);

  useEffect(() => {
    localStorage.setItem("streakStats", JSON.stringify(streakStats));
  }, [streakStats]);

  useEffect(() => {
    const timerActive =
      mode === "speed" || mode === "timed";

    if (!timerActive) return;
    if (!startTime) return;
    if (gameOver) return;
    if (finalTime !== null) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 10);

    return () => clearInterval(interval);
  }, [
    mode,
    startTime,
    gameOver,
    finalTime,
  ]);

  useEffect(() => {
    localStorage.setItem("currentMode", mode);
  }, [mode]);

  useEffect(() => {
    if (creatorMode) return;

    if (
      mode === "speed" &&
      lastResult &&
      lastResult.date === getTodayKey()
    ) {
      setTargetWord(getDailyWord(answers));
      setGuesses(lastResult.guesses);
      setFinalTime(lastResult.finalTime);
    }
  }, [mode, lastResult, creatorMode]);

  useEffect(() => {
    function handleKeyDown(event) {
      const key = event.key;

      if (key === "Enter") {
        submitGuess();
      } else if (key === "Backspace") {
        handleBackspace();
      } else if (/^[a-zA-Z]$/.test(key)) {
        handleLetter(key.toUpperCase());
      } else if (creatorMode && key === "=") {
        setShowCreatorPanel((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentGuess, guesses, gameOver, targetWord, mode, startTime]);

  function resetGame(newMode = mode) {

    if (creatorMode) {
      loadCreatorPuzzle(creatorDate);
      return;
    }

    if ( newMode === "speed" && lastResult && lastResult.date === getTodayKey()) {      
      setTargetWord(getDailyWord(answers));

      if (lastResult) {
        setGuesses(lastResult.guesses);
        setFinalTime(lastResult.finalTime);
      }

      setCurrentGuess("");
      setStartTime(null);

      return;
    }

    const newWord =
      newMode === "speed" ? getDailyWord(answers) : getRandomWord();

    setTargetWord(newWord);
    setGuesses([]);
    setCurrentGuess("");
    setMessage("");

    setStartTime(null);
    setElapsedTime(0);
    setFinalTime(null);
  }

  function loadCreatorPuzzle(dateKey) {
    const word = getDailyWordForDate(answers, dateKey);

    setCreatorDate(dateKey);
    setTargetWord(word);

    setGuesses([]);
    setCurrentGuess("");
    setMessage("");

    setStartTime(null);
    setElapsedTime(0);
    setFinalTime(null);

    setCreatorResult(null);
  }

  function openCreatorMode() {
    const initialDate = creatorDate || addDaysToDateKey(getTodayKey(), 1);

    setCreatorMode(true);
    setMode("speed");

    loadCreatorPuzzle(initialDate);

    window.gtag?.("event", "creator_mode_opened");

    console.log(
      Array.from({ length: 14 }, (_, i) => {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() + i - 2);

        const dateKey = date.toISOString().slice(0, 10);
        const word = getDailyWordForDate(answers, dateKey);

        return `${i + 1}. ${dateKey} → ${word}`;
      }).join("\n")
    );
  }

  function closeCreatorMode() {
    setCreatorMode(false);
    setCreatorResult(null);

    setMode("speed");
    setTargetWord(getDailyWord(answers));

    setGuesses([]);
    setCurrentGuess("");
    setMessage("");

    setStartTime(null);
    setElapsedTime(0);
    setFinalTime(null);

    if (lastResult?.date === getTodayKey()) {
      setGuesses(lastResult.guesses);
      setFinalTime(lastResult.finalTime);
    }
  }

  function changeMode(newMode) {
    if (creatorMode) {
      setMessage("Exit Creator Mode before changing game modes.");
      return;
    }

    window.gtag?.("event", "mode_change", {
      mode: newMode,
    });
    const currentElapsed =
      startTime && (mode === "speed" || mode === "timed") && finalTime === null
        ? Date.now() - startTime
        : elapsedTime;

    const updatedSavedGames = {
      ...savedGames,
      [mode]: {
        targetWord,
        guesses,
        currentGuess,
        elapsedTime: currentElapsed,
        finalTime,
        message,
      },
    };

    setSavedGames(updatedSavedGames);

    const saved = updatedSavedGames[newMode];

    if (saved) {
      setTargetWord(saved.targetWord);
      setGuesses(saved.guesses);
      setCurrentGuess(saved.currentGuess);
      setElapsedTime(saved.elapsedTime || 0);
      setFinalTime(saved.finalTime);
      setMessage(saved.message || "");

      const shouldResumeTimer =
        (newMode === "speed" || newMode === "timed") &&
        saved.finalTime === null &&
        saved.guesses.length > 0;

      setStartTime(
        shouldResumeTimer
          ? Date.now() - (saved.elapsedTime || 0)
          : null
      );
    } else {
      resetGame(newMode);
      setStartTime(null);
    }

    setMode(newMode);

    if (
      newMode === "speed" &&
      !localStorage.getItem("speedHelpShown")
    ) {
      setShowSpeedHelp(true);
    }
  }
  
  function closeSpeedHelp() {
    localStorage.setItem("speedHelpShown", "true");
    setShowSpeedHelp(false);
  }

  function evaluateGuess(guess, wordToEvaluate = targetWord) {
    const result = Array(WORD_LENGTH).fill("absent");
    const targetLetters = wordToEvaluate.split("");
    const guessLetters = guess.split("");

    const remainingLetters = {};

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guessLetters[i] === targetLetters[i]) {
        result[i] = "correct";
      } else {
        remainingLetters[targetLetters[i]] =
          (remainingLetters[targetLetters[i]] || 0) + 1;
      }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === "correct") continue;

      const letter = guessLetters[i];

      if (remainingLetters[letter] > 0) {
        result[i] = "present";
        remainingLetters[letter]--;
      }
    }

    return result;
  }

  function updateClassicStatsAfterWin(newGuesses) {
    const attemptIndex = Math.min(newGuesses.length - 1, 5);

    setClassicStats((prevStats) => ({
      ...prevStats,
      played: prevStats.played + 1,
      wins: prevStats.wins + 1,
      attempts: prevStats.attempts.map((val, i) =>
        i === attemptIndex ? val + 1 : val
      ),
    }));
  }

  function updateClassicStatsAfterLoss() {
    setClassicStats((prevStats) => ({
      ...prevStats,
      played: prevStats.played + 1,
    }));
  }

  function updateTimedStatsAfterWin(totalTime, guessesCount, penalty) {
    setTimedStats((prevStats) => ({
      ...prevStats,
      played: prevStats.played + 1,
      wins: prevStats.wins + 1,

      bestTime:
        prevStats.bestTime === null
          ? totalTime
          : Math.min(prevStats.bestTime, totalTime),

      totalTime: prevStats.totalTime + totalTime,
      totalGuesses: prevStats.totalGuesses + guessesCount,
      totalPenalty: prevStats.totalPenalty + penalty,
      cleanWins: prevStats.cleanWins + (penalty === 0 ? 1 : 0),
    }));
  }

  function updateSpeedStatsAfterWin(totalTime, guessesCount, penalty) {
    setSpeedStats((prevStats) => ({
      ...prevStats,
      played: prevStats.played + 1,
      wins: prevStats.wins + 1,

      bestTime:
        prevStats.bestTime === null
          ? totalTime
          : Math.min(prevStats.bestTime, totalTime),

      totalTime: prevStats.totalTime + totalTime,
      totalGuesses: prevStats.totalGuesses + guessesCount,
      totalPenalty: prevStats.totalPenalty + penalty,
      cleanWins: prevStats.cleanWins + (penalty === 0 ? 1 : 0),
    }));
  }

  function getStreakColor(streak) {
    if (streak >= 100) return "#ff4444";

    const maxStreak = 30;
    const progress = Math.min(streak, maxStreak) / maxStreak;

    const start = {
      r: 83,
      g: 141,
      b: 78,
    };

    const end = {
      r: 255,
      g: 215,
      b: 0,
    };

    const r = Math.round(
      start.r + (end.r - start.r) * progress
    );

    const g = Math.round(
      start.g + (end.g - start.g) * progress
    );

    const b = Math.round(
      start.b + (end.b - start.b) * progress
    );

    return `rgb(${r}, ${g}, ${b})`;
  }

  function updateDailyStreak() {
    setShowDailyAchievement(true);

    const today = getTodayKey();

    setStreakStats((prev) => {
      if (prev.lastCompletedDate === today) {
        return prev;
      }

      const yesterday =
        addDaysToDateKey(today, -1);

      const current =
        prev.lastCompletedDate === yesterday
          ? prev.current + 1
          : 1;

      return {
        ...prev,

        current,

        longest: Math.max(
          prev.longest,
          current
        ),

        lastCompletedDate: today,

        totalDailyCompletions:
          prev.totalDailyCompletions + 1,

        streaksBroken:
          prev.lastCompletedDate &&
          prev.lastCompletedDate !== yesterday
            ? prev.streaksBroken + 1
            : prev.streaksBroken,

        reached3Days:
          prev.reached3Days || current >= 3,

        reached7Days:
          prev.reached7Days || current >= 7,

        reached14Days:
          prev.reached14Days || current >= 14,

        reached30Days:
          prev.reached30Days || current >= 30,

        reached100Days:
          prev.reached100Days || current >= 100,
      };
    });
  }

  function generateShareImage() {
    const result = creatorMode
      ? creatorResult
      : lastResult;

    if (!result) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = 500;
    canvas.height = 650;

    // Background
    ctx.fillStyle = "#121213";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Card
    ctx.fillStyle = "#18181c";
    ctx.strokeStyle = "#2f2f35";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(20, 20, 460, 610, 16);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";

    ctx.fillText("🏆 DAILY", canvas.width / 2, 80);
    ctx.fillText("COMPLETED", canvas.width / 2, 125);

    // Labels
    ctx.fillStyle = "#8d8d8d";
    ctx.font = "32px Arial";
    ctx.textAlign = "left";

    ctx.fillText("Time:", 50, 200);
    ctx.fillText("Guesses:", 50, 260);
    ctx.fillText("Penalty:", 50, 320);

    // Values
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "right";

    ctx.fillText(
      formatTime(result.finalTime),
      450,
      200
    );

    ctx.fillText(
      String(result.guesses.length),
      450,
      260
    );

    ctx.fillText(
      `+${Math.max(0, result.guesses.length - 6) * 20}s`,
      450,
      320
    );

    // Grid
    const tileSize = 55;
    const gap = 8;

    const startX =
      (canvas.width -
        (WORD_LENGTH * tileSize +
          (WORD_LENGTH - 1) * gap)) / 2;

    const startY = 380;

    result.guesses.forEach((guess, rowIndex) => {
      const evaluation = evaluateGuess(
        guess,
        result.targetWord || targetWord
      );

      guess.split("").forEach((letter, colIndex) => {
        let color = "#3a3a3c";

        if (evaluation[colIndex] === "correct")
          color = "#538d4e";

        if (evaluation[colIndex] === "present")
          color = "#b59f3b";

        const x =
          startX + colIndex * (tileSize + gap);

        const y =
          startY + rowIndex * (tileSize + gap);

        // Tile
        ctx.fillStyle = color;
        ctx.fillRect(x, y, tileSize, tileSize);

        // Letter
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 28px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
          "ㅤ",
          x + tileSize / 2,
          y + tileSize / 2
        );
      });
    });

    return canvas;
  }

  function downloadImage() {
    const canvas = generateShareImage();
    if (!canvas) return;

    const link = document.createElement("a");
    const result = creatorMode
      ? creatorResult
      : lastResult;

    link.download = result
      ? `quirdle-${result.date}.png`
      : "quirdle.png";
    link.href = canvas.toDataURL();
    link.click();
  }

  async function copyImageToClipboard() {
    const canvas = generateShareImage();
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        const item = new ClipboardItem({
          "image/png": blob,
        });

        await navigator.clipboard.write([item]);
      });
    } catch (err) {
      console.error(err);
      setMessage("Copy image failed ❌");
    }
  }

  async function submitDailyResult(
    totalTime,
    guessesCount,
    penalty
  ) {
    const { data, error } =
      await supabase
        .from("daily_results")
        .insert({
          player_id: playerId,

          nickname:
            localStorage.getItem(
              "nickname"
            ) || "Anonymous",

          puzzle_date:
            getTodayKey(),

          time_ms:
            totalTime,

          guesses:
            guessesCount,

          penalty,
        })
        .select()
        .single();

    if (error) {
      console.error(error);
      return null;
    }

    return data;
  }

  async function loadLeaderboard(
    period = leaderboardPeriod
  ) {
    if (period === "daily") {
      const { data, error } =
        await supabase
          .from("daily_results")
          .select(
            "id, player_id, nickname, puzzle_date, time_ms"
          )
          .eq(
            "puzzle_date",
            getTodayKey()
          )
          .order(
            "time_ms",
            { ascending: true }
          )
          .limit(5);

      if (error) {
        console.error(
          "Daily leaderboard error:",
          error
        );

        return;
      }

      setLeaderboard(data || []);

      return;
    }

    const startOfWeek =
      getStartOfWeekKey();

    const { data, error } =
      await supabase
        .from("daily_results")
        .select(
          "id, player_id, nickname, puzzle_date, time_ms"
        )
        .gte(
          "puzzle_date",
          startOfWeek
        )
        .lte(
          "puzzle_date",
          getTodayKey()
        );

    if (error) {
      console.error(
        "Weekly leaderboard error:",
        error
      );

      return;
    }

    /*
    * Keep only one result per player per day.
    * If duplicate results exist, keep their fastest.
    */
    const bestDailyResults = {};

    (data || []).forEach((entry) => {
      const key =
        `${entry.player_id}-${entry.puzzle_date}`;

      const existing =
        bestDailyResults[key];

      if (
        !existing ||
        entry.time_ms < existing.time_ms
      ) {
        bestDailyResults[key] = entry;
      }
    });

    /*
    * Combine each player's results for the week.
    */
    const players = {};

    Object.values(
      bestDailyResults
    ).forEach((entry) => {
      if (!players[entry.player_id]) {
        players[entry.player_id] = {
          id: entry.player_id,
          player_id: entry.player_id,
          nickname:
            entry.nickname || "Anonymous",

          totalTime: 0,
          daysPlayed: 0,
        };
      }

      players[entry.player_id].totalTime +=
        entry.time_ms;

      players[entry.player_id].daysPlayed += 1;

      // Keep the player's latest available nickname.
      players[entry.player_id].nickname =
        entry.nickname || "Anonymous";
    });

    const weeklyLeaderboard =
      Object.values(players)
        .map((player) => ({
          ...player,

          averageTime: Math.round(
            player.totalTime /
            player.daysPlayed
          ),
        }))
        .sort((a, b) => {
          /*
          * More completed days ranks higher.
          * Average time breaks equal-day ties.
          */
          if (
            b.daysPlayed !==
            a.daysPlayed
          ) {
            return (
              b.daysPlayed -
              a.daysPlayed
            );
          }

          return (
            a.averageTime -
            b.averageTime
          );
        })
        .slice(0, 5);

    setLeaderboard(
      weeklyLeaderboard
    );
  }

  async function loadPlayerRank() {
    const { data, error } =
      await supabase
        .from("daily_results")
        .select(
          "player_id,time_ms,puzzle_date"
        )
        .eq(
          "puzzle_date",
          getTodayKey()
        )
        .order(
          "time_ms",
          { ascending: true }
        );

    if (error) {
      console.error(error);
      return;
    }

    const rank =
      data.findIndex(
        entry =>
          entry.player_id === playerId
      ) + 1;

    setDailyRank(rank > 0 ? rank : null);
  }

  async function submitGuess() {
    if (gameOver) return;

    if (currentGuess.length !== WORD_LENGTH) {
      setMessage("Word must be 5 letters.");
      return;
    }

    const guess = currentGuess.toLowerCase();

    if (!allowedSet.has(guess)) {
      setMessage("Not a valid word.");
      return;
    }

    const newGuesses = [...guesses, guess];

    setGuesses(newGuesses);
    setCurrentGuess("");

    if (guess === targetWord) {
      if (mode === "speed") {
        const realTime = startTime
          ? Date.now() - startTime
          : 0;

        const extraGuesses = Math.max(
          0,
          newGuesses.length - MAX_ATTEMPTS
        );

        const penalty = extraGuesses * 20000;
        const totalTime = realTime + penalty;

        const resultData = {
          date: creatorMode ? creatorDate : getTodayKey(),
          guesses: newGuesses,
          finalTime: totalTime,
          targetWord,
          creatorMode,
        };

        setFinalTime(totalTime);

        if (creatorMode) {
          setCreatorResult(resultData);

          return;
        }

        window.gtag?.("event", "game_completed", {
          mode,
          guesses: newGuesses.length,
        });

        setLastResult(resultData);
        localStorage.setItem(
          "lastResult",
          JSON.stringify(resultData)
        );

        const isPersonalBest =
          speedStats.bestTime === null ||
          totalTime < speedStats.bestTime;

        setNewPersonalBest(isPersonalBest);

        updateSpeedStatsAfterWin(
          totalTime,
          newGuesses.length,
          penalty
        );

        updateDailyStreak();

        if (!localStorage.getItem("nickname")) {

          setPendingResult({
            totalTime,
            guessesCount: newGuesses.length,
            penalty
          });

          setShowNicknameModal(true);

        } else {

          await submitDailyResult(
            totalTime,
            newGuesses.length,
            penalty
          );

          await new Promise(
            resolve =>
            setTimeout(resolve, 400)
          );

          await loadLeaderboard(leaderboardPeriod);

          const { data } =
            await supabase
              .from("daily_results")
              .select(
                "player_id,time_ms"
              )
              .eq(
                "puzzle_date",
                getTodayKey()
              )
              .order(
                "time_ms",
                { ascending: true }
              );

          const rank =
            data.findIndex(
              row =>
                row.player_id === playerId
            ) + 1;

          setDailyRank(rank);

          await loadPlayerRank();
        }

        return;
      }

      if (mode === "timed") {
        const realTime = startTime
          ? Date.now() - startTime
          : 0;

        const extraGuesses = Math.max(0, newGuesses.length - MAX_ATTEMPTS);
        const penalty = extraGuesses * 20000;
        const totalTime = realTime + penalty;

        setFinalTime(totalTime);

        updateTimedStatsAfterWin(
          totalTime,
          newGuesses.length,
          penalty
        );

        setMessage(`Solved in ${formatTime(totalTime)}!`);

        return;
      }

      setMessage("Nice! You guessed it!");
      updateClassicStatsAfterWin(newGuesses);

      return;
    }

    if (mode === "classic" && newGuesses.length >= MAX_ATTEMPTS) {
      setMessage(`Game over. The word was ${targetWord.toUpperCase()}.`);
      updateClassicStatsAfterLoss();
    }
  }

  function handleLetter(letter) {
    if (gameOver) return;

    if (message && !gameOver) {
      setMessage("");
    }


    if (mode === "speed" && !creatorMode && lastResult && lastResult.date === getTodayKey()) {
      return;
    }


    if (
      (mode === "speed" || mode === "timed")
      && !startTime
    ) {
      setStartTime(Date.now() - elapsedTime);
    }

    if (currentGuess.length < WORD_LENGTH) {
      setCurrentGuess((prev) => prev + letter.toLowerCase());
    }
  }

  function handleBackspace() {
    if (gameOver) return;

    if (message && !gameOver) {
      setMessage("");
    }

    setCurrentGuess((prev) => prev.slice(0, -1));
  }

  function handleKeyboardClick(key) {
    if (key === "ENTER") {
      submitGuess();
    } else if (key === "BACK") {
      handleBackspace();
    } else {
      handleLetter(key);
    }
  }
  
  async function handleShare() {
    window.gtag?.("event", "daily_share");

    if (!lastResult) {
      setMessage("No saved result to share ❌");
      return;
    }

    const text = generateShareText();

    try {
      await navigator.clipboard.writeText(text);
      setMessage("Result copied to clipboard ✅");
    } catch (err) {
      setMessage("Failed to copy ❌");
    }
  }

  function restartGame() {
    resetGame(mode);
  }

  function getKeyboardStatuses() {
    const statuses = {};

    guesses.forEach((guess) => {
      const result = evaluateGuess(guess);

      guess.split("").forEach((letter, index) => {
        const upperLetter = letter.toUpperCase();
        const status = result[index];

        const currentStatus = statuses[upperLetter];

        if (currentStatus === "correct") return;
        if (currentStatus === "present" && status === "absent") return;

        statuses[upperLetter] = status;
      });
    });

    return statuses;
  }

  function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 100);

    if (minutes === 0) {
      return (
        seconds +
        "." +
        String(centiseconds).padStart(1, "0")
      );
    }

    return (
      minutes +
      ":" +
      String(seconds).padStart(2, "0") +
      "." +
      String(centiseconds).padStart(1, "0")
    );
  }


  function formatTimeStats(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (minutes === 0) {
      return `${(ms / 1000).toFixed(1)}s`;
    }

    return (
      minutes +
      ":" +
      String(seconds).padStart(2, "0")
    );
  }

  const keyboardStatuses = getKeyboardStatuses();

  const dailyCompletedToday =
    mode === "speed" &&
    !creatorMode &&
    lastResult &&
    lastResult.date

  const visibleRows =
    mode === "classic"
      ? MAX_ATTEMPTS
      : Math.max(
          MAX_ATTEMPTS,
          guesses.length + (dailyCompletedToday ? 0 : 1)
        );

  const displayedResult = creatorMode
    ? creatorResult
    : lastResult;

  return (
    <div className="app">
      <div className="title-container">
        <h1>Quirdle</h1>
      </div>

      <p className="tagline">
          A daily word challenge against the clock.
      </p>

      <div className="main-layout">
        <div className="left-panel">
          {creatorAccess && !creatorMode && (
            <button
              className="creator-open-button"
              onClick={openCreatorMode}
            >
              🎬 Creator Studio
            </button>
          )}

          {creatorMode && showCreatorPanel && (
            <div className="creator-panel">
              <div className="creator-header">
                <div>
                  <span className="creator-label">
                    CREATOR MODE
                  </span>
                </div>

                <button
                  className="creator-close-button"
                  onClick={closeCreatorMode}
                  aria-label="Exit Creator Mode"
                >
                  ×
                </button>
              </div>

              <label
                className="creator-date-label"
                htmlFor="creator-date"
              >
                Puzzle date
              </label>

              <input
                id="creator-date"
                className="creator-date-input"
                type="date"
                value={creatorDate}
                onChange={(event) => {
                  const newDate = event.target.value;

                  if (newDate) {
                    loadCreatorPuzzle(newDate);
                  }
                }}
              />

              <div className="creator-date-navigation">
                <button
                  onClick={() =>
                    loadCreatorPuzzle(
                      addDaysToDateKey(creatorDate, -1)
                    )
                  }
                >
                  ← Previous
                </button>

                <button
                  onClick={() =>
                    loadCreatorPuzzle(
                      addDaysToDateKey(creatorDate, 1)
                    )
                  }
                >
                  Next →
                </button>
              </div>

              <button
                className="creator-reset-button"
                onClick={() => loadCreatorPuzzle(creatorDate)}
              >
                Reset this attempt
              </button>

              
            </div>
          )}
          <button
            className="mobile-menu-button"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
          >
            ☰
          </button>
          {showMobileMenu && (
            <div className="mobile-menu-panel">

              <button
                onClick={() => {
                  changeMode("classic");
                  setShowMobileMenu(false);
                }}
                className={mode === "classic" ? "active" : ""}
              >
                Classic
              </button>

              <button
                onClick={() => {
                  changeMode("timed");
                  setShowMobileMenu(false);
                }}
                className={mode === "timed" ? "active" : ""}
              >
                Speed Run
              </button>

              <button
                onClick={() => {
                  changeMode("speed");
                  setShowMobileMenu(false);
                }}
                className={mode === "speed" ? "active" : ""}
              >
                Daily
              </button>

            </div>
          )}

          <div className="mode-switcher">
            <button
              className={mode === "classic" ? "active" : ""}
              onClick={() => changeMode("classic")}
            >
              Classic
            </button>

            <button
              className={mode === "timed" ? "active" : ""}
              onClick={() => changeMode("timed")}
            >
              Speed Run
            </button>

            <button
              className={mode === "speed" ? "active" : ""}
              onClick={() => changeMode("speed")}
            >
              Daily
            </button>
          </div>
          
          {(mode === "timed" ||
            (mode === "speed")) && (
            <div className="timer-box">
              <div className="speed-timer-label">
                Timer
              </div>

              <div className="speed-timer">
                {formatTime(finalTime ?? elapsedTime)}
              </div>

              {mode !== "classic" && guesses.length > 6 && (
                <div className="penalty-display">
                  +{(guesses.length - 6) * 20}s penalty
                </div>
              )}
            </div>
          )}
          
          {mode === "speed" && displayedResult && (
            <div className="daily-result-wrapper">
              <button
                className="daily-result-toggle"
                onClick={() =>
                  setShowDailyResult((current) => !current)
                }
                aria-expanded={showDailyResult}
                aria-controls="daily-result-panel"
              >
                <span>🏆 Daily Completed</span>

                <span
                  className={`daily-result-chevron ${
                    showDailyResult ? "open" : ""
                  }`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>

              {showNicknameModal && (
                <div className="modal-overlay">
                  <div className="modal">

                    <h2>🏆 Leaderboard Name</h2>

                    <p>
                      Choose how you'll appear
                      on the Daily Leaderboard.
                    </p>

                    <input
                      className="nickname-input"
                      placeholder="Anonymous"
                      value={nickname}
                      maxLength={15}
                      onChange={(e) =>
                        setNickname(e.target.value)
                      }
                    />

                    <button
                      className="share-button"
                      onClick={async () => {
                        const finalNickname =
                          nickname.trim() || "Anonymous";

                        localStorage.setItem(
                          "nickname",
                          finalNickname
                        );

                        if (pendingResult) {

                          await submitDailyResult(
                            pendingResult.totalTime,
                            pendingResult.guessesCount,
                            pendingResult.penalty
                          );

                          await loadLeaderboard();

                          setPendingResult(null);
                        }

                        setShowNicknameModal(false);
                      }}
                    >
                      Save
                    </button>

                  </div>
                </div>
              )}

              {showDailyResult && (
                <>
                  <button
                    className="daily-result-backdrop"
                    onClick={() => setShowDailyResult(false)}
                    aria-label="Close Daily result"
                  />

                  <div
                    id="daily-result-panel"
                    className="daily-result-card daily-result-popup"
                  >
                    <div className="daily-result-header">
                      <h3>🏆 DAILY COMPLETED</h3>

                      <button
                        className="daily-result-close"
                        onClick={() => setShowDailyResult(false)}
                        aria-label="Close Daily result"
                      >
                        ×
                      </button>
                    </div>

                    {creatorMode && (
                      <div className="result-stat">
                        <span>Puzzle:</span>

                        <strong>
                          {formatDisplayDate(displayedResult.date)}
                        </strong>
                      </div>
                    )}

                    <div className="result-stat">
                      <span>Time:</span>

                      <strong>
                        {formatTime(displayedResult.finalTime)}
                      </strong>
                    </div>

                    {dailyRank && (
                      <div className="result-stat">
                        <span>Rank Today:</span>
                        <strong>
                          🏆 #{dailyRank}
                        </strong>
                      </div>
                    )}

                    <div className="result-stat">
                      <span>Guesses:</span>

                      <strong>
                        {displayedResult.guesses.length}
                      </strong>
                    </div>

                    <div className="result-stat">
                      <span>Penalty:</span>

                      <strong>
                        +{Math.max(
                          0,
                          displayedResult.guesses.length - MAX_ATTEMPTS
                        ) * 20}s
                      </strong>
                    </div>

                    <div className="share-buttons">
                      <button
                        className="share-button"
                        onClick={copyImageToClipboard}
                      >
                        Copy Result
                      </button>

                      <button
                        className="share-button"
                        onClick={downloadImage}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}


        </div>

        <div className="game-area">
          
          <div className="board-section">

            <div className="board">
              {Array.from({ length: visibleRows }).map((_, rowIndex) => {
                const guess = guesses[rowIndex];

                let rowLetters = Array(WORD_LENGTH).fill("");
                let rowStatuses = Array(WORD_LENGTH).fill("");

                if (guess) {
                  rowLetters = guess.toUpperCase().split("");
                  rowStatuses = evaluateGuess(guess);
                } else if (rowIndex === guesses.length) {
                  rowLetters = currentGuess
                    .toUpperCase()
                    .padEnd(WORD_LENGTH)
                    .split("");
                }

                return (
                  <div className="row" key={rowIndex}>
                    {rowLetters.map((letter, colIndex) => (
                      <div
                        key={colIndex}
                        className={`tile ${
                          guess ? `submitted ${rowStatuses[colIndex]}` : ""
                        }`}
                        style={{
                          animationDelay: `${colIndex * 0.25}s`,
                        }}
                      >
                        {letter.trim()}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <p className="message">{message}</p>

            {gameOver && (mode !== "speed" || creatorMode) && (
              <button
                className="restart-button"
                onClick={restartGame}
              >
                Restart game
              </button>
            )}
          </div>

          {!(mode === "speed" &&
            lastResult &&
            lastResult.date === getTodayKey()) && (
              <div className="keyboard">
              {keyboardRows.map((row, rowIndex) => (
                <div className="keyboard-row" key={rowIndex}>
                  {row.map((key) => {
                    const status = keyboardStatuses[key] || "";

                    return (
                      <button
                        key={key}
                        className={`key ${status} ${
                          key === "ENTER" || key === "BACK" ? "wide-key" : ""
                        }`}
                        onClick={() => handleKeyboardClick(key)}
                      >
                        {key === "BACK" ? "⌫" : key}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {showLeaderboard && (
          <div className="modal-overlay">
            <div className="modal leaderboard-modal">

              <h2>🏆 Leaderboard</h2>

              <div className="leaderboard-tabs">
                <button
                  className={
                    leaderboardPeriod === "daily"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setLeaderboardPeriod("daily")
                  }
                >
                  Daily
                </button>

                <button
                  className={
                    leaderboardPeriod === "weekly"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setLeaderboardPeriod("weekly")
                  }
                >
                  Weekly
                </button>
              </div>

              <div className="leaderboard-period-label">
                {leaderboardPeriod === "daily"
                  ? "Today's fastest times"
                  : "This week: completions and average time"}
              </div>

              <div className="leaderboard">
                {leaderboard.length === 0 ? (
                  <div className="leaderboard-empty">
                    No results yet.
                  </div>
                ) : (
                  leaderboard.map(
                    (entry, index) => (
                      <div
                        key={entry.id}
                        className="leaderboard-row"
                      >
                        <span className="leaderboard-rank">
                          #{index + 1}
                        </span>

                        <span className="leaderboard-name">
                          {entry.nickname ||
                            "Anonymous"}
                        </span>

                        {leaderboardPeriod ===
                        "daily" ? (
                          <strong>
                            {formatTimeStats(
                              entry.time_ms
                            )}
                          </strong>
                        ) : (
                          <div className="weekly-score">
                            <strong>
                              {entry.daysPlayed}
                              {entry.daysPlayed === 1
                                ? " day"
                                : " days"}
                            </strong>

                            <small>
                              {formatTimeStats(
                                entry.averageTime
                              )} avg
                            </small>
                          </div>
                        )}
                      </div>
                    )
                  )
                )}
              </div>

              <button
                className="close-button"
                onClick={() =>
                  setShowLeaderboard(false)
                }
              >
                Close
              </button>

            </div>
          </div>
        )}

        <div className="stats-column">
          <button
            className="leaderboard-button desktop-leaderboard-button"
            onClick={() =>
              setShowLeaderboard(
                !showLeaderboard
              )
            }
          >
            Leaderboards
          </button>

          <button
            className="stats-button desktop-stats-button"
            onClick={() => setShowStats(!showStats)}
          >
            My Stats
          </button>
          
          {showDailyAchievement && (
            <div className="modal-overlay">
              <div className="modal achievement-modal">

                <h2>🏆 Daily Completed</h2>

                {newPersonalBest && (
                  <div className="achievement-item">
                    ⚡ New Personal Best
                  </div>
                )}

                <div
                  className="achievement-item"
                  style={{
                    color: getStreakColor(
                      streakStats.current
                    )
                  }}
                >
                  🔥 {streakStats.current} Day Streak
                </div>

                <button
                  className="share-button"
                  onClick={() =>
                    setShowDailyAchievement(false)
                  }
                >
                  Nice!
                </button>

              </div>
            </div>
          )}

          <button
            className="stats-button mobile-stats-button"
            onClick={() => setShowStats(!showStats)}
            aria-label="Statistics"
          >
            📊
          </button>

          <button
            className="leaderboard-button mobile-leaderboard-button"
            onClick={() =>
              setShowLeaderboard(
                !showLeaderboard
              )
            }
          >
            🏆
          </button>

          {showStats && (
            <div className="stats-panel">
              {mode === "classic" ? (
                <>
                  <div className="result-stat">
                    <span>Played:</span>
                    <strong>{classicStats.played}</strong>
                  </div>

                  <div className="result-stat">
                    <span>Wins:</span>
                    <strong>{classicStats.wins}</strong>
                  </div>

                  <div className="result-stat">
                    <span>Win Rate:</span>
                    <strong>
                      {classicStats.played === 0
                        ? "0%"
                        : `${Math.round(
                            (classicStats.wins / classicStats.played) * 100
                          )}%`}
                    </strong>
                  </div>

                  <h4>Attempts</h4>

                  <div className="distribution">
                    {classicStats.attempts.map((count, i) => {
                      const maxAttemptsCount = Math.max(
                        ...classicStats.attempts,
                        1
                      );

                      const barWidth = `${(count / maxAttemptsCount) * 100}%`;

                      return (
                        <div key={i} className="bar-row">
                          <span>{i + 1}</span>

                          <div className="bar-wrapper">
                            <div
                              className="bar"
                              style={{ width: barWidth }}
                            >
                              {count}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : mode === "timed" ? (
                <>
                  <div className="result-stat">
                    <span>Played:</span>
                    <strong>{timedStats.played}</strong>
                  </div>

                  <div className="result-stat">
                    <span>Wins:</span>
                    <strong>{timedStats.wins}</strong>
                  </div>

                  <div className="result-stat">
                    <span>Best Time:</span>
                    <strong>
                      {timedStats.bestTime === null
                        ? "-"
                        : formatTimeStats(timedStats.bestTime)}
                    </strong>
                  </div>

                  <div className="result-stat">
                    <span>Average Time:</span>
                    <strong>
                      {timedStats.wins === 0
                        ? "-"
                        : formatTimeStats(
                            Math.round(timedStats.totalTime / timedStats.wins)
                          )}
                    </strong>
                  </div>

                  <div className="result-stat">
                    <span>Average Guesses:</span>
                    <strong>
                      {timedStats.wins === 0
                        ? "-"
                        : (timedStats.totalGuesses / timedStats.wins).toFixed(1)}
                    </strong>
                  </div>
                </>
              ) : (
                <>
                  <div className="result-stat">
                    <span>Played:</span>
                    <strong>{speedStats.played}</strong>
                  </div>

                  <div className="result-stat">
                    <span>Wins:</span>
                    <strong>{speedStats.wins}</strong>
                  </div>

                  <div className="result-stat">
                    <span>Best Time:</span>
                    <strong>
                      {speedStats.bestTime === null
                        ? "-"
                        : formatTimeStats(speedStats.bestTime)}
                    </strong>
                  </div>

                  <div className="result-stat">
                    <span>Average Time:</span>
                    <strong>
                      {speedStats.wins === 0
                        ? "-"
                        : formatTimeStats(
                            Math.round(speedStats.totalTime / speedStats.wins)
                          )}
                    </strong>
                  </div>

                  <div className="result-stat">
                    <span>Average Guesses:</span>
                    <strong>
                      {speedStats.wins === 0
                        ? "-"
                        : (speedStats.totalGuesses / speedStats.wins).toFixed(1)}
                    </strong>
                  </div>

                  <div className="result-stat">
                    <span>Current streak:</span>
                    <strong>{streakStats.current}</strong>
                  </div>

                  <div className="result-stat">
                    <span>Longest streak:</span>
                    <strong>{streakStats.longest}</strong>
                  </div>

                  {(streakStats.reached3Days || streakStats.reached7Days || streakStats.reached14Days || streakStats.reached30Days || streakStats.reached100Days) && (
                    <h4>🏆 Milestones</h4>
                  )}
                  <div className="milestone-list">

                    {streakStats.reached3Days && (
                      <div>🔥 3 Day Streak</div>
                    )}

                    {streakStats.reached7Days && (
                      <div>🔥 7 Day Streak</div>
                    )}

                    {streakStats.reached14Days && (
                      <div>🔥 14 Day Streak</div>
                    )}

                    {streakStats.reached30Days && (
                      <div>🔥 30 Day Streak</div>
                    )}

                    {streakStats.reached100Days && (
                      <div>🏆 100 Day Legend</div>
                    )}

                  </div>
                </>
              )}
            </div>
          )}

          {showAbout && (
            <div className="modal-overlay">
              <div className="modal">

                <h2>About Quirdle</h2>
                <br></br>
                <p>
                  Hi, I'm Dominik.
                </p>
                <br></br>
                <p>
                  Quirdle started as a small side project because I
                  enjoy word games and wanted something a little
                  faster and more competitive than a traditional
                  daily puzzle.
                </p>
                <br></br>
                <p>
                  The goal is simple:
                  solve the word as quickly as possible.
                </p>

                <p>
                  Whether you're chasing a personal best in
                  Speed Run mode or competing against everyone
                  in the Daily challenge, Quirdle is designed
                  to be quick, challenging, and fun.
                </p>
                <br></br>
                <p>
                  Thanks for playing ❤️
                </p>

                <hr />

                <p>
                  If you enjoy Quirdle and would like to support
                  future development, you can buy me a coffee ☕
                </p>
                
                <a
                  href="https://www.buymeacoffee.com/quirdle"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    window.gtag?.("event", "support_click");
                    setShowAbout(false);
                  }}
                >
                  <img
                    className="bmc-button"
                    src="https://cdn.buymeacoffee.com/buttons/v2/default-green.png"
                    alt="Buy Me a Coffee"
                ></img>
                </a>

                <button
                  className="close-button"
                  onClick={() => setShowAbout(false)}
                >
                  Close
                </button>

              </div>
            </div>
          )}
        </div>

        {showSpeedHelp && mode === "speed" && !creatorMode && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>🔥 Quirdle</h2>

            <p>
              Find the daily word as fast as possible.
            </p>

            <ul>
              <li>✅ Same word for everyone each day</li>
              <li>✅ Unlimited guesses</li>
              <li>✅ Timer starts on first key press</li>
              <li>✅ After 6 guesses: +20s penalty per guess</li>
              <li>✅ You only get one daily completion</li>
              <li>✅ Share your result afterwards</li>
            </ul>

            <button
              className="share-button"
              onClick={closeSpeedHelp}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
      </div>
      <footer className="footer-links">
        <button
          className="footer-link"
          onClick={() => {
            window.gtag?.("event", "about_open");
            setShowAbout(true);
          }}
        >
          About
        </button>
      </footer>
    </div>
  );
}

export default App;