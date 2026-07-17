import { useEffect, useMemo, useState } from "react";
import { answers, allowedWords } from "./words";
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

function hashString(text) {
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function getDailyWord(wordList) {
  const todayKey = getTodayKey();
  const hash = hashString(todayKey);
  return wordList[hash % wordList.length].toLowerCase();
}

function getRandomWord() {
  return answers[Math.floor(Math.random() * answers.length)].toLowerCase();
}

function App() {
  const [mode, setMode] = useState(
    () => localStorage.getItem("currentMode") || "classic"
  );

  const [targetWord, setTargetWord] = useState(() => getRandomWord());
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

  const [lastResult, setLastResult] = useState(() => {
    const saved = localStorage.getItem("lastResult");
    return saved ? JSON.parse(saved) : null;
  });

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
    localStorage.setItem(
      "savedGames",
      JSON.stringify(savedGames)
    );
  }, [savedGames]);
  
  useEffect(() => {
    localStorage.setItem("timedStats", JSON.stringify(timedStats));
  }, [timedStats]);

  useEffect(() => {
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
    mode,
    targetWord,
    guesses,
    currentGuess,
    elapsedTime,
    finalTime,
    message,
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
    if (
      mode === "speed" &&
      lastResult &&
      lastResult.date === getTodayKey()
    ) {
      setGuesses(lastResult.guesses);
      setFinalTime(lastResult.finalTime);
    }
  }, [mode, lastResult]);

  useEffect(() => {
    function handleKeyDown(event) {
      const key = event.key;

      if (key === "Enter") {
        submitGuess();
      } else if (key === "Backspace") {
        handleBackspace();
      } else if (/^[a-zA-Z]$/.test(key)) {
        handleLetter(key.toUpperCase());
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentGuess, guesses, gameOver, targetWord, mode, startTime]);

  function resetGame(newMode = mode) {

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

    setElapsedTime(0);
    setFinalTime(null);
  }

  function changeMode(newMode) {
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

  function evaluateGuess(guess) {
    const result = Array(WORD_LENGTH).fill("absent");
    const targetLetters = targetWord.split("");
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

  function generateShareImage() {
    if (!lastResult) return;

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
      formatTime(lastResult.finalTime),
      450,
      200
    );

    ctx.fillText(
      String(lastResult.guesses.length),
      450,
      260
    );

    ctx.fillText(
      `+${Math.max(0, lastResult.guesses.length - 6) * 20}s`,
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

    lastResult.guesses.forEach((guess, rowIndex) => {
      const result = evaluateGuess(guess);

      guess.split("").forEach((letter, colIndex) => {
        let color = "#3a3a3c";

        if (result[colIndex] === "correct")
          color = "#538d4e";

        if (result[colIndex] === "present")
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
    link.download = "quirdle.png";
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

  function submitGuess() {
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

        const extraGuesses = Math.max(0, newGuesses.length - MAX_ATTEMPTS);
        const penalty = extraGuesses * 20000;
        const totalTime = realTime + penalty;

        const resultData = {
          date: getTodayKey(),
          guesses: newGuesses,
          finalTime: totalTime,
        };

        setLastResult(resultData);
        localStorage.setItem("lastResult", JSON.stringify(resultData));

        setFinalTime(totalTime);

        updateSpeedStatsAfterWin(
          totalTime,
          newGuesses.length,
          penalty
        );

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

    if (mode === "speed" && lastResult) {
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
      return `${seconds}s`;
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
    lastResult &&
    lastResult.date === getTodayKey();

  const visibleRows =
    mode === "classic"
      ? MAX_ATTEMPTS
      : Math.max(
          MAX_ATTEMPTS,
          guesses.length + (dailyCompletedToday ? 0 : 1)
        );


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
          <select
            className="mode-select-mobile"
            value={mode}
            onChange={(e) => changeMode(e.target.value)}
          >
            <option value="classic">Classic</option>
            <option value="timed">Speed Run</option>
            <option value="speed">Daily</option>
          </select>

          <div className="mode-switcher vertical">
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

          {(mode === "speed" || mode === "timed") && (
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
          
          {mode === "speed" && lastResult && (
            <div className="daily-result-card">

              <h3>🏆 DAILY COMPLETED</h3>

              <div className="result-stat">
                <span>Time: </span>
                <strong>
                  {formatTime(lastResult.finalTime)}
                </strong>
              </div>

              <div className="result-stat">
                <span>Guesses: </span>
                <strong>{lastResult.guesses.length}</strong>
              </div>

              <div className="result-stat">
                <span>Penalty: </span>
                <strong>
                  +{Math.max(0, lastResult.guesses.length - 6) * 20}s
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

            {gameOver && mode !== "speed" && (
              <button className="restart-button" onClick={restartGame}>
                Restart game
              </button>
            )}
          </div>

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
        </div>
        
        <div className="stats-column">
          <button
            className="stats-button"
            onClick={() => setShowStats(!showStats)}
          >
            My Stats
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

                  <div className="result-stat">
                    <span>Average Penalty:</span>
                    <strong>
                      {timedStats.wins === 0
                        ? "-"
                        : `${Math.round(
                            timedStats.totalPenalty / timedStats.wins / 1000
                          )}s`}
                    </strong>
                  </div>

                  <div className="result-stat">
                    <span>Clean Solves:</span>
                    <strong>{timedStats.cleanWins}</strong>
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
                    <span>Average Penalty:</span>
                    <strong>
                      {speedStats.wins === 0
                        ? "-"
                        : `${Math.round(
                            speedStats.totalPenalty / speedStats.wins / 1000
                          )}s`}
                    </strong>
                  </div>

                  <div className="result-stat">
                    <span>Clean Solves:</span>
                    <strong>{speedStats.cleanWins}</strong>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        {showSpeedHelp && mode === "speed" && (
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
    </div>
  );
}

export default App;