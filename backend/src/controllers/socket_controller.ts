/**
 * Socket Controller
 */
import Debug from "debug";
import { Server, Socket } from "socket.io";
import {
	ClickTimesMap,
	ClientToServerEvents,
	GetGameWithPlayers,
	ServerToClientEvents,
	VirusClickedData,
} from "@shared/types/SocketTypes";
import {
	createPlayer,
	deletePlayer,
	getPlayer,
	increasePlayerScore,
	updatePlayerScore,
	resetPlayer,
} from "../services/player_service";
import {
	createGame,
	getGame,
	getGameWithPlayers,
	increaseRounds,
	resetClicksInDatabase,
} from "../services/game_service";
import { createHighscore } from "../services/highscore_service";
import { ExtendedPlayer, Game, Player } from "@shared/types/Models";
import { createResult, getResults } from "../services/result_service";
import { getHighscores } from "../services/highscore_service";

// Create a new debug instance
const debug = Debug("backend:socket_controller");

// Create global game object for clicktimes
const clickTimesMap: ClickTimesMap = {};

// // Track waiting players
let waitingPlayers: Player[] = [];

// Get and emit results from database to client
const sendResultsToClient = async (socket: Socket) => {
	const results = await getResults();
	socket.emit("sendResults", results);
};

// Get and emit highscores from database to client
const sendHighscoresToClient = async (socket: Socket) => {
	const highscores = await getHighscores();
	socket.emit("sendHighscores", highscores);
};

// Function to position the virus in the game
const setPositionOfVirus = (
	gameRoomId: string,
	io: Server,
	debug: Debug.Debugger
) => {
	let gridColumn: number = getRandomNumber(1, 10);
	let gridRow: number = getRandomNumber(1, 10);
	let virusDelay: number = getRandomNumber(1500, 10000);

	debug(`gridColumnn is: ${gridColumn}`);
	debug(`gridRow is: ${gridRow} `);
	debug(`delay is: ${virusDelay} `);

	// Emit an event to clients with the position of the virus
	io.to(gameRoomId).emit("setVirusPosition", gridColumn, gridRow, virusDelay);
};

// Function to generate a random number
const getRandomNumber = (min: number, max: number): number => {
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

// function to create a game and join players to it
const createGameAndJoinPlayers = async (
	waitingPlayers: ExtendedPlayer[],
	io: Server,
	debug: Debug.Debugger,
	getGameWithPlayers: GetGameWithPlayers,
	socket: Socket
) => {
	// create game when there are two players in the waitingPlayers array
	if (waitingPlayers.length >= 2) {
		// Take the first two players from the waiting list
		let playersForGame = waitingPlayers.splice(0, 2);
		const gameRoom = await createGame(playersForGame);
		debug(`Created gameRoom with id:, ${gameRoom.id}`);

		// reset click count in the database for the new game
		await resetClicksInDatabase(gameRoom.id);

		// Iterate over each player in playersForGame and join the game room
		// get socket connection with io.sockets.sockets.get by using the players ID
		// do this only if a player is found
		playersForGame.forEach((player) => {
			io.sockets.sockets.get(player.id)?.join(gameRoom.id);
			debug(`Socket ${player.id} joined room ${gameRoom.id}`);
			// Associate player with the game
			player.gameId = gameRoom.id;
		});
		// empty playersForGame
		playersForGame = [];

		// Emit an event to inform players that a game is created/started
		io.to(gameRoom.id).emit("gameCreated", gameRoom.id);

		// get list of players in room..
		const playersInGame = await getGameWithPlayers(gameRoom.id);

		//...IF there are any players
		if (playersInGame) {
			// send list of players to the room
			io.to(gameRoom.id).emit(
				"playersJoinedGame",
				playersInGame?.players
			);
		}

		// Remove players from waitingPlayers array
		waitingPlayers.splice(0, waitingPlayers.length);

		let playerOneName = playersInGame?.players[0].playername || null;
		let playerTwoName = playersInGame?.players[1].playername || null;
		debug(
			`Name of player one is: ${playerOneName}. Name of player two is: ${playerTwoName}`
		);
		// make players leave the waiting players array when creating game
		waitingPlayers = [];

		playerOneName = playersInGame?.players[0].playername || null;
		playerTwoName = playersInGame?.players[1].playername || null;
		debug(
			`Name of player one is: ${playerOneName}. Name of player two is: ${playerTwoName}`
		);

		// Emit event to set the position of the virus
		setPositionOfVirus(gameRoom.id, io, debug);
	}
};

// handle connection function
export const handleConnection = (
	socket: Socket<ClientToServerEvents, ServerToClientEvents>,
	io: Server<ClientToServerEvents, ServerToClientEvents>
) => {
	let gameId: string | null;
	debug("🙋 A user connected", socket.id);

	// send highscores to the client
	sendResultsToClient(socket);

	// send highscores to the client
	sendHighscoresToClient(socket);

	// get reaction times from client
	socket.on("clickTimes", (playerOneClicks, playerTwoClicks) => {
		debug(
			`player one's clicks: ${playerOneClicks} aaand player two's clicks: ${playerTwoClicks}`
		);
	});

	// Listen for a player join request from the client when a player submits a form
	socket.on("playerJoinRequest", async (playername, callback) => {
		debug(`player ${playername} wants to join the game`);

		// this will be broadcasted to all connected clients
		// for testing purposes only, remove later
		io.emit("playerJoined", playername, Date.now());

		// if it's a new player creat a new player
		// if it's not a new player add player that wants to play again to the waitingPlayers array
		// Add player to waiting players array
		const player = await createPlayer({
			id: socket.id,
			playername,
			clickTimes: [],
			score: 0,
			gameId: null,
		});

		waitingPlayers.push(player);

		// Server responds to the client with success and players from waiting players array
		callback({
			success: true,
			game: {
				id: gameId!,
				clicks: 0,
				rounds: 0,
				players: waitingPlayers,
			},
		});

		// call on createGameAndJoinPlayers function
		createGameAndJoinPlayers(
			waitingPlayers,
			io,
			debug,
			getGameWithPlayers,
			socket
		);
	});

	// Handle if a player wants to play again and add them to the waiting players array!
	socket.on("playerJoinAgainRequest", async (playerName, callback) => {
		debug("the player that wants to play again is: ", playerName);

		// empty waiting players array if the player wants to play again and again and again
		// Check if there are already waiting players
		const hasWaitingPlayers = waitingPlayers.length > 0;

		// get player with socket.io
		let playerId = socket.id;

		// reset value 0
		let resetValue = 0;

		// Call the reset score
		if (playerId) {
			await resetPlayer(playerId, resetValue);
			debug(`Reset score for player ${playerId}`);
		}

		// Clear waiting players if no one is waiting
		if (!hasWaitingPlayers) {
			waitingPlayers = [];
			debug("waiting players before joining: ", waitingPlayers);
		}

		if (playerName) {
			let player = {
				id: socket.id,
				playername: playerName,
				score: 0,
				clickTimes: [],
			};
			debug("Playername recieved:", playerName);
			waitingPlayers.push(player);
		}
		// Server responds to the client with success and players from waiting players array
		callback({
			success: true,
			game: {
				id: gameId!,
				clicks: 0,
				rounds: 0,
				players: waitingPlayers,
			},
		});
		// Call on createGameAndJoinPlayers function when there are two players in the waitingPlayers array
		if (waitingPlayers.length === 2) {
			createGameAndJoinPlayers(
				waitingPlayers,
				io,
				debug,
				getGameWithPlayers,
				socket
			);
		}
	});

	//Listen for clicks on virus from client
	socket.on(
		"virusClicked",
		async ({
			gameId,
			playerId,
			playerName,
			reactionTime,
		}: VirusClickedData) => {
			debug(
				"Received virusClicked event. Player ID:",
				playerId,
				"Reaction time:",
				reactionTime,
				"Playername: ",
				playerName
			);

			// Update player score in the database each time a player clicks
			await updatePlayerScore(playerId, reactionTime);

			// Get player from database
			const player = await getPlayer(playerId);

			// abort if there is no player
			if (!player) {
				debug("Player not found. Aborting.");
				return;
			}

			// Get game from database
			let game = await getGame(gameId);
			if (!game) {
				return;
			}

			// get game with players
			const playersInGame = game.players;
			debug("players in game are: ", playersInGame);

			// get clickTimes from players in the game
			const playerOneTimes = game.players[0].clickTimes;
			const playerTwoTimes = game.players[1].clickTimes;
			debug(
				"Player one click times: %o, Player two click times: %o",
				playerOneTimes,
				playerTwoTimes
			);

			// check if gameId is on existing clickTimesMap
			if (!clickTimesMap[gameId]) {
				// initialise new clickTimesMap if gameId is not present
				clickTimesMap[gameId] = {
					firstClick: { playerId: "", clickTime: null },
					secondClick: { playerId: "", clickTime: null },
				};
			}

			// check if first click is already added
			if (!clickTimesMap[gameId].firstClick.playerId) {
				// if first click is not set, add it as first click
				clickTimesMap[gameId].firstClick = {
					playerId: playerId,
					clickTime: reactionTime,
				};
				console.log(
					"First players clickTime saved:",
					clickTimesMap[gameId].firstClick
				);
			} else if (!clickTimesMap[gameId].secondClick.playerId) {
				// If the first click is saved but not the second, add it as second click
				clickTimesMap[gameId].secondClick = {
					playerId: playerId,
					clickTime: reactionTime,
				};
				debug(
					"Second player's clicktime saved:",
					clickTimesMap[gameId].secondClick
				);
			}

			// function to determine roundWinner
			const determineRoundWinner = async (
				gameId: string,
				playerId: string
			) => {
				// get the game from database
				const game = await getGame(gameId);

				// abort if no game is found
				if (!game) {
					return;
				}

				// get player id's from database and match with player that clicked
				// the second clicker's id will id that is passed to function
				const firstPlayerThatClicked = game.players.find(
					(player) => player.id !== playerId
				);

				debug("first player that clicked: ", firstPlayerThatClicked);
				const secondPlayerThatClicked = game.players.find(
					(player) => player.id === playerId
				);
				debug("second player that clicked: ", secondPlayerThatClicked);

				if (!firstPlayerThatClicked || !secondPlayerThatClicked) {
					console.log("Could not find both players.");
					return;
				}

				// Retrieving click times for both players from clickTimesMap
				const firstPlayerThatClickedClickTime =
					firstPlayerThatClicked.clickTime;
				const secondPlayerThatClickedClickTime =
					secondPlayerThatClicked.clickTime;

				debug(
					"firstPlayerThatClickedClickTime:",
					firstPlayerThatClickedClickTime
				);
				debug(
					"secondPlayerThatClickedClickTime:",
					secondPlayerThatClickedClickTime
				);

				if (
					firstPlayerThatClickedClickTime &&
					secondPlayerThatClickedClickTime
				) {
					let roundWinner: string | null = null;
					if (
						firstPlayerThatClickedClickTime <
						secondPlayerThatClickedClickTime
					) {
						roundWinner = firstPlayerThatClicked.playername;
						console.log(
							`${firstPlayerThatClicked.id} wins the round!`
						);
						// Updating player's score in the database
						await increasePlayerScore(firstPlayerThatClicked.id);
					} else if (
						secondPlayerThatClickedClickTime <
						firstPlayerThatClickedClickTime
					) {
						roundWinner = secondPlayerThatClicked.playername;
						console.log(
							`${secondPlayerThatClicked.id} wins the round!`
						);
						// Updating player's score in the database
						await increasePlayerScore(secondPlayerThatClicked.id);
					} else {
						console.log("It was a tie, no one wins the round");
					}
					// Sending round result to clients
					io.to(gameId).emit("roundResult", roundWinner);
				} else {
					console.log("Missing click times for both players.");
				}

				// empty clickTimesMap before next round
				clickTimesMap[gameId] = {
					firstClick: { playerId: "", clickTime: null },
					secondClick: { playerId: "", clickTime: null },
				};
			};

			//Determine the winner of the game based on player scores
			const determineGameWinner = async (
				gameId: string,
				players: Player[],
				updatedScores: number[]
			): Promise<string> => {
				let maxScore = -1;
				let winningPlayerName = "";

				const game = await getGame(gameId);

				// abort if there is no game
				if (!game) {
					throw new Error("Game not found");
				}

				// get players in game
				players = game.players;

				// calculate scores and determine winner
				for (let i = 0; i < players.length; i++) {
					const player = players[i];
					const score = updatedScores[i]; // Retrieve the updated score for the current player
					if (score !== null && score > maxScore) {
						maxScore = score;
						winningPlayerName = player.playername;
					} else if (score !== null && score === maxScore) {
						// If there's a tie...
						winningPlayerName = "It's a tie!";
					}
					// emit game winner to client
					io.to(gameId).emit("gameWinner", winningPlayerName);
				}

				return winningPlayerName;
			};

			const endGameFunction = async (
				gameId: string,
				players: Player[]
			) => {
				try {
					let game = await getGame(gameId);

					if (!game) {
						return;
					}

					players = game.players;

					// Update game with the latest player scores
					players.forEach((player) => {
						const updatedPlayer = game?.players.find(
							(p) => p.id === player.id
						);
						if (updatedPlayer) {
							player.score = updatedPlayer.score; // Update the player's score
						}
					});

					// Define updatedScores
					const updatedScores = players.map(
						(player) => player.score || 0
					);
					// Get scores from database for each player
					const playerOneScore = updatedScores[0];
					const playerTwoScore = updatedScores[1];

					// Get highscore for each player, clicktimes / 10
					const highscorePlayerOne = calcHighscore(
						game.players[0].clickTimes
					);
					const highscorePlayerTwo = calcHighscore(
						game.players[1].clickTimes
					);

					// Create game result
					const newResult = await createResult({
						playerOneName: game.players[0].playername,
						playerTwoName: game.players[1].playername,
						playerOneHighscore: highscorePlayerOne,
						playerTwoHighscore: highscorePlayerTwo,
						playerOnePoint: playerOneScore,
						playerTwoPoint: playerTwoScore,
						timestamp: Date.now(),
					});

					// Create highscore entries
					await Promise.all([
						createHighscore({
							playername: game.players[0].playername,
							highscore: highscorePlayerOne,
						}),
						createHighscore({
							playername: game.players[1].playername,
							highscore: highscorePlayerTwo,
						}),
					]);

					// Determine game winner
					const gameWinner = determineGameWinner(
						game.id,
						game.players,
						updatedScores
					);

					// Emit end game event
					io.to(gameId).emit("endGame");
				} catch (error) {
					console.error("Error in endGameFunction:", error);
				}
			};

			if (
				clickTimesMap[gameId].firstClick.playerId &&
				clickTimesMap[gameId].secondClick.playerId
			) {
				// Convert the array of objects into an array of ExtendedPlayer objects
				const extendedPlayers: ExtendedPlayer[] = game.players.map(
					(player) => ({
						id: player.id,
						playername: player.playername,
						clickTimes: player.clickTimes,
						clickTime:
							player.clickTime !== null ? player.clickTime : 0,
						score: 0,
					})
				);
				// increase rounds and clear latest reaction time from database
				const newRounds = game.rounds + 1;
				if (newRounds < 10) {
					await increaseRounds(gameId, newRounds);
					// clear clicks from clickTimesMap instead of database
					clickTimesMap[gameId] = {
						firstClick: { playerId: "", clickTime: null },
						secondClick: { playerId: "", clickTime: null },
					};
					// increase player score in database after round
					await determineRoundWinner(gameId, playerId);

					// if there are two clicks in clickTimesMap, position new virus
					setPositionOfVirus(gameId, io, debug);
					io.to(gameId).emit("playersClickedVirus", extendedPlayers);

					// end game after last round is played
				} else if (newRounds === 10) {
					// determine roundWinner for last round without setting virus position
					await determineRoundWinner(gameId, playerId);
					io.to(gameId).emit("playersClickedVirus", extendedPlayers);

					io.to(gameId).emit("showGif");
					// delay endGame
					setTimeout(() => {
						endGameFunction(gameId, extendedPlayers);
					}, 2000);
				}
			} else {
				debug(
					"Both players haven't clicked yet. Waiting for both clicks..."
				);
			}
		}
	);

	// Calc clicktimes to get highscore
	const calcHighscore = (clickTimes: number[]) => {
		let sum = 0;
		for (let i = 0; i < clickTimes.length; i++) {
			sum += clickTimes[i];
		}
		return sum / 10;
	};

	// listen for when a player wants to leave the game
	socket.on("playerWantsToLeave", async () => {
		debug("a player wants to leave us", socket.id);

		// remove the player who wants to leave
		await deletePlayer(socket.id);
		debug("deleted the player with id, ", socket.id);
	});

	// Handle disconnect
	socket.on("disconnect", async () => {
		debug("a player disconnected", socket.id);

		// Remove the disconnected player from waiting players array
		const index = waitingPlayers.findIndex(
			(player) => player.id === socket.id
		);
		if (index !== -1) {
			waitingPlayers.splice(index, 1);
		}

		// find player in order to find out which room they were in
		const player = await getPlayer(socket.id);
		// if player didn't exist, don't do anything
		if (!player) {
			return;
		}

		const gameId = player.gameId;
		const playerName = player.playername;

		// let other player in room know that the other player left
		if (gameId) {
			io.to(gameId).emit("playerDisconnected", playerName);

			// leave the room
			io.sockets.sockets.get(socket.id)?.leave(gameId);
		}
	});
};
