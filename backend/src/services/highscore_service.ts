/**
 * Highscore service
 */

import { HighscoreData } from "@shared/types/SocketTypes";
import prisma from "../prisma";

// Get all highscores from database
// Only get latest 10 highscores

export const getHighscores = async () => {
	return await prisma.highscore.findMany({
		orderBy: {
			highscore: "asc",
		},
		take: 10,
	});
};

export const createHighscore = (data: HighscoreData) => {
	// create result and store in database
	return prisma.highscore.create({
		data,
	});
};
