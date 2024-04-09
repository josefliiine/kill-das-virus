/**
 * Result Service
 */

import prisma from "../prisma";
import { ResultData } from "@shared/types/SocketTypes";

// query database for list of results
// only get latest 10 results

export const getResults = async () => {
	return await prisma.result.findMany({
		orderBy: {
			timestamp: "desc",
		},
		take: 10,
	});
};

/**
 * Get a single result
 *
 * @param resultId Result ID
 */
export const getResult = (resultId: string) => {
	return prisma.game.findUnique({
		where: {
			id: resultId,
		},
	});
};

/**
 * Create a new result when game ends
 * @param data is the data provided by the ended game
 */

export const createResult = (data: ResultData) => {
	// create result and store in database
	return prisma.result.create({
		data,
	});
};
