/**
 * Game Service
 */

import { Game, Player } from "@shared/types/Models";
import prisma from "../prisma";

export const getGames = async () => {
	// query database for list of games
	return await prisma.game.findMany({
		orderBy: {
			id: "asc",
		},
	});
};

/**
 * Get a single game
 *
 * @param gameId Game ID
 */
export const getGame = (gameId: string) => {
	return prisma.game.findUnique({
		where: {
			id: gameId,
		},
		include: { players: true },
	});
};

/**
 * Create a new game (room)
 */

export const createGame = (waitingPlayers: Player[]) => {
	// create game and connect waiting players directly
	return prisma.game.create({
		data: {
			clicks: 0, // Set initial value for clicks
			rounds: 0, // Set initial value for rounds
			players: {
				connect: waitingPlayers.map((player) => ({ id: player.id })),
			},
		},
	});
};

/**
 * Get a single game with players to see if players were added
 * @param gameId
 * @returns
 */

export const getGameWithPlayers = async (gameId: string) => {
	return prisma.game.findUnique({
		where: {
			id: gameId,
		},
		include: {
			players: true,
		},
	});
};

/**
 * Reset clicks in database
 */

export const resetClicksInDatabase = async (gameId: string) => {
	return prisma.game.update({ where: { id: gameId }, data: { clicks: 0 } });
};

/**
 * Increase rounds for a game in the database
 *
 * @param gameId The ID of the game to update
 * @param rounds The new value of rounds
 * @returns A Promise resolving to the updated game object
 */
export const increaseRounds = (gameId: string, rounds: number) => {
	return prisma.game.update({
		where: {
			id: gameId,
		},
		data: {
			rounds: rounds,
		},
	});
};
