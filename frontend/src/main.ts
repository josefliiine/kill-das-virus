import { io, Socket } from "socket.io-client";
import {
  ClientToServerEvents,
  HighscoreData,
  PlayerJoinResponse,
  ResultData,
  ServerToClientEvents,
} from "@shared/types/SocketTypes";
import "./assets/scss/style.scss";
import { ExtendedPlayer } from "@shared/types/Models";

const SOCKET_HOST = import.meta.env.VITE_SOCKET_HOST;

// Connect to Socket.IO Server
const socket: Socket<ServerToClientEvents, ClientToServerEvents> =
  io(SOCKET_HOST);

// Forms
const playerNameFormEl = document.querySelector(
  "#username-form"
) as HTMLFormElement;
const playerNameInputEl = document.querySelector(
  "#username"
) as HTMLInputElement;

// Pages
const startPage = document.querySelector("#start-page") as HTMLElement;
const gamePage = document.querySelector("#game-page") as HTMLElement;
const resultPage = document.querySelector("#result-page") as HTMLElement;

// result page details
const gameWinnerInfoEl = document.querySelector("#game-winner") as HTMLElement;
const trophyImgEl = document.querySelector("#trophy-img") as HTMLImageElement;

// Player Details
let playerName: string = "";
let playerOne: string | null = null;
let playerTwo: string | null = null;
let playerOneScore: number = 0;
let playerTwoScore: number = 0;

// keep as score, updates scoreboard with score/points
const playerOneScoreEl = document.querySelector(
  "#player-one-score"
) as HTMLSpanElement;
const playerTwoScoreEl = document.querySelector(
  "#player-two-score"
) as HTMLSpanElement;

// reaction times for players in game
let playerOneClickedTimes: number[] = [];
let playerTwoClickedTimes: number[] = [];

// Spinning loaders on startpage
const highScoreSpinningLoaderEl = document.querySelector("#spinning-loader-hs");
const resultSpinningLoaderEl = document.querySelector("#spinning-loader-rs");

// Game Details
let gameId: string = "";
const gameInfoEl = document.querySelector("#game-info-text") as HTMLElement;
const playerOneTimer = document.querySelector(
  "#player-one-timer"
) as HTMLElement;
const playerTwoTimer = document.querySelector(
  "#player-two-timer"
) as HTMLElement;

// Time variable for comparison with click
let timeForComparison = 0;

// Variable/Boolean for time comparison
let waitingForClick = false;

// grid container
const gridContainer = document.querySelector(
  "#grid-container"
) as HTMLDivElement;

const gridVirus = document.getElementById("gridVirus");
// game page header
const gamePageHeaderEl = document.querySelector("#game-header") as HTMLElement;

// score board wrapper
const scoreBoardWrapper = document.querySelector(
  "#score-board-display"
) as HTMLDivElement;
let timerInterval: number;

//let gameScoreEl = document.querySelector("#score") as HTMLElement;
const virus = document.getElementById("gridVirus");

// reference to gif
const waitingForResultsGif = document.querySelector(
  "#gif-wrapper"
) as HTMLDivElement;

// add eventlistener to player name form
const showGamePage = () => {
  playerNameFormEl.addEventListener("submit", (e) => {
    e.preventDefault();

    // Get player name
    playerName = playerNameInputEl.value.trim();

    if (!playerName) {
      return;
    }

    // clear input field
    playerNameInputEl.value = "";

    // send request to server with neccessary information
    // Emit player join request event to server and wait for acknowledgement
    socket.emit(
      "playerJoinRequest",
      playerName,
      handlePlayerGameJoinRequestCallback
    );

    // Show game page
    startPage.classList.add("hide");
    gamePage.classList.remove("hide");

    // inform waiting player that they are waiting for next player to join
    gameInfoEl.innerText = "Waiting for player two to join....";
  });
};

// Game functions

// Hide virus in game function
const hideVirus = () => {
  if (virus) {
    // add class of hide
    virus.classList.add("hide");
    // remove listning for clicks
    virus.removeEventListener("click", hideVirus);
  }
};

// Define the handleVirusClick function
function handleVirusClick() {
  // Remove the event listener to prevent multiple clicks
  if (!virus) {
    return;
  }
  virus.removeEventListener("click", handleVirusClick);
  if (waitingForClick) {
    stopTimer();
    const reactionTime = Date.now() - timeForComparison;
    const playerId = socket.id;

    if (!playerId) {
      return;
    }

    // place timer in gameInfoEl
    gameInfoEl.innerText = formatTime(reactionTime);

    // push each players click time to their clickedTimes array
    if (playerName === playerOne) {
      playerOneClickedTimes.push(reactionTime);
    } else if (playerName === playerTwo) {
      playerTwoClickedTimes.push(reactionTime);
    }

    // Emit virusClicked event to server
    socket.emit("virusClicked", { playerId, gameId, playerName, reactionTime });
  }

  hideVirus();

  // Reset waitingForClick to true for the next click
  waitingForClick = true; // Add this line to reset waitingForClick to true

  // Once both players have clicked, send the clicked times to the server
  socket.emit("clickTimes", playerOneClickedTimes, playerTwoClickedTimes);
}

// Handle case where the player did not click
const handleNoClickDetected = () => {
  if (waitingForClick) {
    stopTimer();
    const reactionTime = 30000; // Assuming the max time as reaction time when no click is detected
    const playerId = socket.id;

    if (!playerId) {
      return;
    }

    // Update the gameInfoEl to show the max time
    gameInfoEl.innerText = "00:30:000";

    // Emit the "virusClicked" event with the max time as the reaction time
    socket.emit("virusClicked", { playerId, gameId, playerName, reactionTime });

    // Reset waitingForClick state
    waitingForClick = true;
  }
};

const startGame = () => {
  gamePageHeaderEl.innerText = "KILL DAS VIRUS";
  // show gameInfoEl
  gameInfoEl.classList.remove("hide");

  // show gridcontainer
  gridContainer.classList.remove("hide-div");

  // show scoreboard wrapper div
  scoreBoardWrapper.classList.remove("hide-div");

  // inform players that game is about to start
  gameInfoEl.innerText = "Get ready to start DAS GAME!";

  // Remove the existing event listener before adding a new one
  socket.off("setVirusPosition");

  // add event listener again
  socket.on("setVirusPosition", (gridColumn, gridRow, virusDelay) => {
    // Show virus
    const placeVirus = (delay: number) => {
      setTimeout(() => {
        //const gridVirus = document.getElementById("gridVirus");
        if (gridVirus) {
          // Set position of virus
          gridVirus.style.gridColumn = String(gridColumn);
          gridVirus.style.gridRow = String(gridRow);
          // Remove hideclass
          gridVirus.classList.remove("hide");
          gameInfoEl.innerText = "KLICKEN DAS VIRUS!";

          startTimer();

          // Set time for comparison
          timeForComparison = Date.now();
          waitingForClick = true;

          gridVirus.addEventListener("click", handleVirusClick);
        }
      }, delay);
    };
    placeVirus(virusDelay);
  });
};

// Callback-function to handle servers response to player wanting to join game
const handlePlayerGameJoinRequestCallback = (response: PlayerJoinResponse) => {
  if (!response.success) {
    alert("Could not join game!");
    return;
  }

  showGamePage();
};

// Handle case where user wants to play again
// let server know that player wants to play again

// reference to the restart button
const restartGameBtnEl = document.querySelector(
  "#new-game-button"
) as HTMLButtonElement;

// Event listener for the restart button
restartGameBtnEl.addEventListener("click", () => {
  resultPage.classList.add("hide");
  startPage.classList.add("hide");
  gamePage.classList.remove("hide");

  // empty scores
  playerOneScore = 0;
  playerTwoScore = 0;

  // Clear player clicked times arrays
  playerOneClickedTimes = [];
  playerTwoClickedTimes = [];

  // clear timer interval
  clearInterval(timerInterval);
  // hide virus
  virus?.classList.add("hide");

  // Clear previous event listener for virus click
  virus?.removeEventListener("click", handleVirusClick);

  // clear game info
  gameInfoEl.innerText = "Waiting for player two..";

  // change header when player joins again
  let playerThatClickedRestart = {
    id: socket.id,
    name: playerName,
  };

  if (playerThatClickedRestart.name) {
    if (!playerThatClickedRestart.name || !playerThatClickedRestart.id) {
      return;
    }
    // Emit playerJoinAgainRequest event to server
    socket.emit(
      "playerJoinAgainRequest",
      playerThatClickedRestart.name,
      handlePlayerGameJoinRequestCallback
    );
  }
});

// Handle case where player wants to leave the game
// reference to the leave game button
const leaveGameBtnEl = document.querySelector(
  "#quit-game-button"
) as HTMLButtonElement;

leaveGameBtnEl.addEventListener("click", () => {
  resultPage.classList.add("hide");

  // send event to server so server can delete player from database
  socket.emit("playerWantsToLeave");

  // empty scores
  playerOneScore = 0;
  playerTwoScore = 0;

  playerOneScoreEl.innerText = "0";
  playerTwoScoreEl.innerText = "0";

  playerOneTimer.innerText = "0 ms";
  playerTwoTimer.innerText = "0 ms";

  // hide grid-container
  gridContainer.classList.add("hide-div");

  // clear timer interval
  clearInterval(timerInterval);

  // hide virus
  virus?.classList.add("hide");

  // Clear previous event listener for virus click
  virus?.removeEventListener("click", handleVirusClick);

  // clear game info
  gameInfoEl.innerText = "";

  // hide scoreboard and prevous rounds
  scoreBoardWrapper.classList.add("hide-div");

  // Clear player clicked times arrays
  playerOneClickedTimes = [];
  playerTwoClickedTimes = [];

  startPage.classList.remove("hide");
  setTimeout(() => {
    location.reload();
  });
});
// end game function
const endGame = () => {
  // end the game and give player option to play again on resultpage
  gamePage.classList.add("hide");
  resultPage.classList.remove("hide");

  // empty scores
  playerOneScore = 0;
  playerTwoScore = 0;

  playerOneScoreEl.innerText = "0";
  playerTwoScoreEl.innerText = "0";

  playerOneTimer.innerText = "0 ms";
  playerTwoTimer.innerText = "0 ms";

  // hide grid-container
  gridContainer.classList.add("hide-div");

  // clear timer interval
  clearInterval(timerInterval);

  // hide virus
  virus?.classList.add("hide");

  // Clear previous event listener for virus click
  virus?.removeEventListener("click", handleVirusClick);

  // clear game info
  gameInfoEl.innerText = "";

  // hide scoreboard and prevous rounds
  scoreBoardWrapper.classList.add("hide-div");

  // Clear player clicked times arrays
  playerOneClickedTimes = [];
  playerTwoClickedTimes = [];

  // Listen for game winner or if it was a tie
  socket.on("gameWinner", (winner) => {
    // Display the winner
    if (!winner) {
      return;
    }

    gameWinnerInfoEl.innerText = winner;
  });
};

// Function to clear results from startpage when disconneted from server
const clearResults = () => {
  const startPageGameResultUlEl = document.querySelector(
    "#start-page-stats-gameresults"
  );
  if (startPageGameResultUlEl) {
    startPageGameResultUlEl.innerHTML = "";
  }
};

// Function to clear highscores from startpage when disconnected from server
const clearHighscores = () => {
  const startPageHighscoreUlEl = document.querySelector(
    "#start-page-stats-highscore"
  );
  if (startPageHighscoreUlEl) {
    startPageHighscoreUlEl.innerHTML = "";
  }
};

// Listen for when connection is established
socket.on("connect", () => {
  // hide loading spinners when connecting
  highScoreSpinningLoaderEl?.classList.add("hide");
  resultSpinningLoaderEl?.classList.add("hide");

  // call on showGamePage function when connection is established
  showGamePage();
});

// Listen for when server got tired of us
socket.on("disconnect", () => {
  // call on functions to clear highscore and results
  clearResults();
  clearHighscores();

  // show loading spinner when connecting
  highScoreSpinningLoaderEl?.classList.remove("hide");
  resultSpinningLoaderEl?.classList.remove("hide");

  // end the game and give player option to play again on resultpage
  gamePage.classList.add("hide");
  resultPage.classList.remove("hide");

  // let the player who is left know what happened
  gameWinnerInfoEl.innerText = `Something went wrong, try again later...`;

  // hide the trophy image since nobody won!
  trophyImgEl.classList.add("hide");

  // hide the new game wrapper div
  const newGameWrapperEl = document.querySelector("#new-game-wrapper");
  newGameWrapperEl?.classList.add("hide-div");
});

// Listen for when we're reconnected (either due to our or the servers connection)
// Listen for when we're reconnected (either due to our or the servers connection)
socket.io.on("reconnect", () => {
  console.log("🍽️ Reconnected to the server:", SOCKET_HOST);
  console.log("🔗 Socket ID:", socket.id);

  clearResults();
  clearHighscores();

  gamePage.classList.add("hide");
  resultPage.classList.add("hide");
  
  const reconnectedText = document.querySelector(".intro") as HTMLParagraphElement;
  reconnectedText.innerText = "YOU'VE BEEN RECONNECTED! Let's give it another go and play another round of Kill Das Virus!"
});

// // Listen for when a new player wants to joins a game
// socket.on("playerJoined", (playername, timestamp) => {
//   console.log(
//     "Msg to all connected clients: A new player wants to join the game: ",
//     playername,
//     timestamp
//   );
// });

// Listen for when a game is created

socket.on("gameCreated", (gameRoomId) => {
  gameId = gameRoomId;

  // call on start game function
  startGame();
});
// Listen for a list of online players in game

socket.on("playersJoinedGame", (players) => {
  playerOne = players[0].playername;
  playerTwo = players[1].playername;

  // player id's
  // let playerOneId = players[0].id === socket.id;
  // let playerTwoId = players[1].id === socket.id;

  // set player's names on score board display when game starts
  const playerOneNameEl = document.querySelector(
    "#player-one-name"
  ) as HTMLElement;
  const playerTwoNameEl = document.querySelector(
    "#player-two-name"
  ) as HTMLElement;

  // Set players names on scoreboard points
  const playerScoreOneNameEl = document.querySelector(
    "#player-one-name-score"
  ) as HTMLElement;
  const playerScoreTwoNameEl = document.querySelector(
    "#player-two-name-score"
  ) as HTMLElement;

  // Scoreboard names
  playerScoreOneNameEl.innerText = playerOne;
  playerScoreTwoNameEl.innerText = playerTwo;

  // Previous round names
  playerOneNameEl.innerText = playerOne;
  playerTwoNameEl.innerText = playerTwo;
});

// start values timer
const startTimer = () => {
  const startTime = Date.now();

  const timerFunc = () => {
    const currentTime = Date.now();
    const elapsedTime = currentTime - startTime;

    if (elapsedTime >= 30000) {
      stopTimer();
      gameInfoEl.innerText = "00:30:000";
      // inform server that the user did not click
      handleNoClickDetected();
      hideVirus();
      return;
    }

    const minutes = Math.floor(elapsedTime / 60000);
    const seconds = Math.floor((elapsedTime % 60000) / 1000);
    const milliseconds = elapsedTime % 1000;

    const durationInMinutes = minutes.toString().padStart(2, "0");
    const durationInSeconds = seconds.toString().padStart(2, "0");
    const durationInMilliseconds = milliseconds.toString().padStart(3, "0");
    gameInfoEl.innerText = `${durationInMinutes}:${durationInSeconds}:${durationInMilliseconds}`;
  };

  // Call for timeFunc
  timerFunc();

  // update the timer
  timerInterval = setInterval(timerFunc, 1);
};

// Define the stopTimer function to clear the interval:
function stopTimer() {
  clearInterval(timerInterval);
}

// Listen for player click times

// Define a function to handle the "playersClickedVirus" event asynchronously
const handlePlayersClickedVirusAsync = async (players: ExtendedPlayer[]) => {
  // Update previous time for players after each round
  playerOneTimer.innerText = `${String(players[0].clickTime)} ms`;
  playerTwoTimer.innerText = `${String(players[1].clickTime)} ms`;
};

// Listen for the "playersClickedVirus" event
socket.on("playersClickedVirus", async (players) => {
  await handlePlayersClickedVirusAsync(players);
});

// Listen for winner of each round!
// .. and hand out points to winner

// Define an asynchronous function to handle round result
const handleRoundResult = async (winner: string | null) => {
  if (winner === playerOne) {
    playerOneScore++;
  } else if (winner === playerTwo) {
    playerTwoScore++;
  } else {
  }

  // Update scoreboard with current points and convert points to string
  playerOneScoreEl.innerText = String(playerOneScore);
  playerTwoScoreEl.innerText = String(playerTwoScore);
};

// Listen for round result and call the asynchronous function
socket.on("roundResult", async (winner) => {
  await handleRoundResult(winner);
});

// Listen for funny gifs

socket.on("showGif", () => {
  //show gif
  waitingForResultsGif.classList.remove("hide");
});

// Function to render results to start page
const renderResults = (results: ResultData[]) => {
  const startPageGameResultUlEl = document.querySelector(
    "#start-page-stats-gameresults"
  );

  // Loop through results and create li elements
  results.forEach((result) => {
    // Game Result
    const liGameResultEl = document.createElement("li");
    
    // Check if player two's score is greater than player one's score
    if (result.playerTwoPoint > result.playerOnePoint) {
      liGameResultEl.innerHTML = `
        <span class="player-one-points-name">${result.playerTwoName}: </span>
        <span class="stats-point">${result.playerTwoPoint} p</span> vs
        <span class="player-two-point-name">${result.playerOneName}: </span>
        <span class="stats-point">${result.playerOnePoint} p</span>`;
    } else {
      liGameResultEl.innerHTML = `
        <span class="player-one-points-name">${result.playerOneName}: </span>
        <span class="stats-point">${result.playerOnePoint} p</span> vs
        <span class="player-two-point-name">${result.playerTwoName}: </span>
        <span class="stats-point">${result.playerTwoPoint} p</span>`;
    }

    startPageGameResultUlEl?.appendChild(liGameResultEl);
  });
};

// Listen for the results and then call render function
socket.on("sendResults", (results) => {
  renderResults(results);
});

const renderHighscores = (results: HighscoreData[]) => {
  const startPageHighscoreUlEl = document.querySelector(
    "#start-page-stats-highscore"
  ) as HTMLUListElement;

  // Loop through results and create li elements
  results.forEach((highscore) => {
    // High Score
    const liHighScoreEl = document.createElement("li");
    liHighScoreEl.innerHTML = `
      <span class="stats-player-name">${highscore.playername}: </span>
      <span class="stats-points">${highscore.highscore} ms</span>
     
    `;

    startPageHighscoreUlEl.appendChild(liHighScoreEl);
  });
};
// Listen for the highscores and then call the render function

socket.on("sendHighscores", (highscores) => {
  renderHighscores(highscores);
});

// listen for when a player leaves the game
// end game and go to result page

socket.on("playerDisconnected", (playername) => {
  // end the game
  endGame();

  // give player option to play again on resultpage
  gamePage.classList.add("hide");
  resultPage.classList.remove("hide");

  // let the player who is left know what happened
  gameWinnerInfoEl.innerText = `The game has ended because ${playername} left the game!`;

  // hide the trophy image since nobody won!
  trophyImgEl.classList.add("hide");
});

const formatTime = (ms: number) => {
  const minutes = Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor((ms % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  const milliseconds = (ms % 1000).toString().padStart(3, "0");
  return `${minutes}:${seconds}:${milliseconds}`;
};

// listen for server to end the game after 10 rounds
socket.on("endGame", () => {
  //hide gif
  waitingForResultsGif.classList.add("hide");
  //end game
  endGame();
});
