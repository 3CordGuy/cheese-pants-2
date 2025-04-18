import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';

export interface CheesePants2Methods {
	closeSessions(): Promise<void>;
}

export type WsMessage =
	| { type: 'message'; data: string }
	| { type: 'quit'; gameId: string }
	| { type: 'join'; gameId: string; playerName: string; playerId: string }
	| { type: 'get-game-state' }
	| { type: 'get-game-state-response'; gameState: GameState }
	| { type: 'add-word'; word: string; playerId: string }
	| { type: 'delete-word'; index: number; playerId: string }
	| { type: 'change-turn'; newCurrentPlayerId: string; playerId: string }
	| { type: 'update-turn-time-limit'; newTimeLimit: number; playerId: string }
	| { type: 'game-complete'; sentence: string[] }
	| { type: 'test-connection' }
	| { type: 'remove-player'; playerIdToRemove: string; playerId: string }
	| { type: 'start-game'; playerId: string };

export type WordInfo = {
	text: string;
	authorId: string;
	authorName: string;
	addedAt: string; // ISO 8601
	isRequired: boolean;
	matchedRequiredWordIndex?: number; // Only set if this word matches a required word
};

export type Player = {
	id: string;
	name: string;
	isCurrentTurn: boolean;
};

export type GameState = {
	gameId: string;
	players: Player[];
	connectedPlayers: Player['id'][];
	words: WordInfo[];
	startedAt: string; // ISO 8601
	endedAt: string | null; // ISO 8601
	startedById: string | null;
	requiredWords: string[];
	hasRequiredWords: boolean[];
	currentPlayerIndex: number;
	phase: 'lobby' | 'playing' | 'complete';
	turnTimeLimit: number; // seconds per turn (0 for no limit)
	lastTurnStartTime: string | null; // ISO 8601 timestamp when current turn started
};

export class CheesePants2RPC extends WorkerEntrypoint<Env> {
	async closeSessions() {
		const id = this.env.CHEESE_PANTS_2.idFromName('globalRoom');
		const stub = this.env.CHEESE_PANTS_2.get(id) as unknown as DurableObjectStub & CheesePants2Methods;
		// Invoking Durable Object RPC method. Same `wrangler dev` session.
		await stub.closeSessions();

		// Note: Not supported in `wrangler dev`
		// const id = cf.env.CURSOR_SESSIONS.idFromName("globalRoom");
		// const stub = cf.env.CURSOR_SESSIONS.get(id);
		// await stub.closeSessions();
	}
}

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */

export class CheesePants2 extends DurableObject<Env> implements CheesePants2Methods {
	gameState: GameState;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.gameState = {
			gameId: '',
			players: [],
			connectedPlayers: [],
			words: [],
			startedAt: new Date().toISOString(),
			endedAt: null,
			startedById: null,
			requiredWords: [],
			hasRequiredWords: [],
			currentPlayerIndex: 0,
			phase: 'lobby',
			turnTimeLimit: 0,
			lastTurnStartTime: null,
		};

		// Then load from storage and apply migrations if needed
		ctx.blockConcurrencyWhile(async () => {
			const storedGameState = await ctx.storage.get<GameState>('gameState');
			if (storedGameState) {
				// Migrate fields if they don't exist
				if (storedGameState.turnTimeLimit === undefined) {
					storedGameState.turnTimeLimit = 0;
				}
				if (storedGameState.lastTurnStartTime === undefined) {
					storedGameState.lastTurnStartTime = null;
				}
				this.gameState = storedGameState;
			}
		});

		if (this.gameState.turnTimeLimit === undefined) {
			this.gameState.turnTimeLimit = 0; // Default to no limit
		}

		if (this.gameState.lastTurnStartTime === undefined && this.gameState.turnTimeLimit > 0) {
			this.gameState.lastTurnStartTime = new Date().toISOString(); // Initialize if needed
		}
	}

	// Save the current game state to storage
	async saveGameState() {
		await this.ctx.storage.put('gameState', this.gameState);
	}

	broadcast(message: WsMessage, self?: string) {
		this.ctx.getWebSockets().forEach((ws) => {
			const attachment = ws.deserializeAttachment();
			if (!attachment) return;
			const { id } = attachment;
			if (id !== self) ws.send(JSON.stringify(message));
		});
	}

	async checkAndProcessTurnTimeout() {
		// If game isn't in playing phase or no time limit, exit
		if (this.gameState.phase !== 'playing' || this.gameState.turnTimeLimit <= 0 || !this.gameState.lastTurnStartTime) {
			return false; // No timeout occurred or no timer active
		}

		const now = new Date();
		const turnStartTime = new Date(this.gameState.lastTurnStartTime);
		const elapsedSeconds = (now.getTime() - turnStartTime.getTime()) / 1000;

		// If the time limit has been exceeded, advance to the next player
		if (elapsedSeconds >= this.gameState.turnTimeLimit) {
			const timedOutPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
			const timedOutPlayerId = timedOutPlayer.id;
			const timedOutPlayerName = timedOutPlayer.name;

			// Send a specific message to the timed-out player
			this.ctx.getWebSockets().forEach((ws) => {
				const attachment = ws.deserializeAttachment();
				if (!attachment) return;
				const { id } = attachment;

				if (id === timedOutPlayerId) {
					// Message to the player whose turn timed out
					ws.send(
						JSON.stringify({
							type: 'message',
							data: 'Your time is up! Moving on to the next player!',
						})
					);
				} else {
					// Message to all other players
					ws.send(
						JSON.stringify({
							type: 'message',
							data: `${timedOutPlayerName}'s turn timed out!`,
						})
					);
				}
			});

			await this.advanceToNextPlayer(this.gameState);
			return true; // Timeout was processed
		}

		return false; // No timeout occurred
	}

	async webSocketMessage(ws: WebSocket, message: string) {
		if (typeof message !== 'string') return;

		await this.checkAndProcessTurnTimeout();

		const parsedMsg: WsMessage = JSON.parse(message);

		switch (parsedMsg.type) {
			case 'test-connection':
				// Get player ID from attachment
				const attachment = ws.deserializeAttachment();
				if (attachment && attachment.id) {
					const playerId = attachment.id;

					// Ensure this player is in the connectedPlayers list
					if (!this.gameState.connectedPlayers.includes(playerId)) {
						console.log(`Adding player ${playerId} to connectedPlayers on test-connection`);
						this.gameState.connectedPlayers.push(playerId);
						await this.saveGameState();
						// Broadcast updated state to all clients
						this.broadcast({ type: 'get-game-state-response', gameState: this.gameState });
					}
				}

				// Respond with the current game state and a pong message
				ws.send(JSON.stringify({ type: 'pong' }));
				ws.send(JSON.stringify({ type: 'get-game-state-response', gameState: this.gameState }));
				break;

			case 'join':
				// If the join message has a valid gameId get the gameState add the player to the session
				if (parsedMsg.gameId) {
					this.gameState.gameId = parsedMsg.gameId;
				}

				// Check if player already exists in the session
				if (this.gameState.players.some((p) => p.id === parsedMsg.playerId)) {
					// Update connected players if they're reconnecting
					if (!this.gameState.connectedPlayers.includes(parsedMsg.playerId)) {
						this.gameState.connectedPlayers.push(parsedMsg.playerId);
						await this.saveGameState();

						// Broadcast the updated state to all connected players
						this.broadcast({ type: 'get-game-state-response', gameState: this.gameState });
					}

					// Send personal confirmation message to the reconnected player
					ws.send(JSON.stringify({ type: 'message', data: 'Reconnected to game!' }));
					ws.send(JSON.stringify({ type: 'get-game-state-response', gameState: this.gameState }));

					// Set the player ID as attachment for message handling
					ws.serializeAttachment({ id: parsedMsg.playerId });
					return;
				}

				const newPlayer: Player = {
					id: parsedMsg.playerId,
					name: parsedMsg.playerName,
					isCurrentTurn: this.gameState.players.length === 0,
				};
				this.gameState.players.push(newPlayer);
				this.gameState.connectedPlayers.push(newPlayer.id);

				if (this.gameState.players.length === 1) {
					// First player becomes admin
					this.gameState.startedById = parsedMsg.playerId;
				}

				// Save the updated game state
				await this.saveGameState();

				ws.serializeAttachment({ id: parsedMsg.playerId });
				this.broadcast({ type: 'get-game-state-response', gameState: this.gameState });
				break;

			case 'get-game-state':
				const wsMessage: WsMessage = { type: 'get-game-state-response', gameState: this.gameState };
				ws.send(JSON.stringify(wsMessage));
				break;

			case 'start-game':
				if (this.gameState.phase !== 'lobby') {
					ws.send(JSON.stringify({ type: 'message', data: 'Game already started.' }));
					break;
				}
				if (parsedMsg.playerId !== this.gameState.startedById) {
					ws.send(JSON.stringify({ type: 'message', data: 'Only the host can start the game.' }));
					break;
				}
				this.gameState.phase = 'playing';
				this.gameState.startedAt = new Date().toISOString();

				// Initialize the turn start time when the game starts
				this.gameState.lastTurnStartTime = new Date().toISOString();

				// Save the updated game state
				await this.saveGameState();

				this.broadcast({ type: 'get-game-state-response', gameState: this.gameState });
				break;

			case 'delete-word':
				// Only allow the admin to delete words
				if (parsedMsg.playerId !== this.gameState.startedById) {
					ws.send(JSON.stringify({ type: 'message', data: 'Only the game admin can delete words.' }));
					break;
				}

				// Verify game is in playing phase
				if (this.gameState.phase !== 'playing') {
					ws.send(JSON.stringify({ type: 'message', data: 'Can only delete words during the game.' }));
					break;
				}

				// Verify valid index
				if (parsedMsg.index < 0 || parsedMsg.index >= this.gameState.words.length) {
					ws.send(JSON.stringify({ type: 'message', data: 'Invalid word index.' }));
					break;
				}

				// Get word being deleted to check if it was a required word
				const deletedWord = this.gameState.words[parsedMsg.index];

				// If this was a required word, reset that requirement flag
				if (deletedWord.isRequired && deletedWord.matchedRequiredWordIndex !== undefined) {
					this.gameState.hasRequiredWords[deletedWord.matchedRequiredWordIndex] = false;
				}

				// Remove the word
				this.gameState.words.splice(parsedMsg.index, 1);

				// Reset all required word flags and recheck with remaining words
				this.gameState.hasRequiredWords.fill(false);
				this.gameState.words.forEach((wordInfo) => {
					const wordWithoutPunctuation = wordInfo.text.replace(/[.,!?;:'"()[\]{}]/g, '').toLowerCase();
					this.gameState.requiredWords.forEach((requiredWord, index) => {
						if (wordWithoutPunctuation === requiredWord.toLowerCase()) {
							this.gameState.hasRequiredWords[index] = true;
							wordInfo.isRequired = true;
							wordInfo.matchedRequiredWordIndex = index;
						}
					});
				});

				// Save the updated game state
				await this.saveGameState();

				// Broadcast updated state to all clients
				this.broadcast({ type: 'get-game-state-response', gameState: this.gameState });
				break;

			case 'change-turn':
				// Only allow the admin to change turns
				if (parsedMsg.playerId !== this.gameState.startedById) {
					ws.send(JSON.stringify({ type: 'message', data: 'Only the game admin can change turns.' }));
					break;
				}

				// Verify game is in playing phase
				if (this.gameState.phase !== 'playing') {
					ws.send(JSON.stringify({ type: 'message', data: 'Can only change turns during the game.' }));
					break;
				}

				// Find the player to give the turn to
				const playerIndex = this.gameState.players.findIndex((p) => p.id === parsedMsg.newCurrentPlayerId);
				if (playerIndex === -1) {
					ws.send(JSON.stringify({ type: 'message', data: 'Player not found.' }));
					break;
				}

				// Update the current player turn
				this.gameState.players.forEach((p) => (p.isCurrentTurn = false));
				this.gameState.players[playerIndex].isCurrentTurn = true;
				this.gameState.currentPlayerIndex = playerIndex;

				// Save the updated game state
				await this.saveGameState();

				// Broadcast updated state to all clients
				this.broadcast({
					type: 'get-game-state-response',
					gameState: this.gameState,
				});
				break;

			case 'update-turn-time-limit':
				// Only allow the admin to change the time limit
				if (parsedMsg.playerId !== this.gameState.startedById) {
					ws.send(JSON.stringify({ type: 'message', data: 'Only the host can change the turn time limit.' }));
					break;
				}

				// Ensure we have a valid time limit (0 or positive)
				const newTimeLimit = Math.max(0, parsedMsg.newTimeLimit);
				const oldTimeLimit = this.gameState.turnTimeLimit;

				console.log('Updating turn time limit:', { oldTimeLimit, newTimeLimit });

				// Update the time limit
				this.gameState.turnTimeLimit = newTimeLimit;

				// Always initialize/reset timer when changing to a positive value
				if (newTimeLimit > 0) {
					this.gameState.lastTurnStartTime = new Date().toISOString();
					console.log('Timer enabled, lastTurnStartTime set to:', this.gameState.lastTurnStartTime);
				} else {
					// When disabling the timer, set lastTurnStartTime to null
					this.gameState.lastTurnStartTime = null;
					console.log('Timer disabled, lastTurnStartTime set to null');
				}

				// Save the updated game state
				await this.saveGameState();

				// Log the updated game state for debugging
				console.log('Updated game state:', {
					turnTimeLimit: this.gameState.turnTimeLimit,
					lastTurnStartTime: this.gameState.lastTurnStartTime,
				});

				// Send a message to all players
				this.broadcast({
					type: 'message',
					data: newTimeLimit > 0 ? `Game host changed turn time limit to ${newTimeLimit} seconds` : 'Game host removed the turn time limit',
				});

				// Broadcast updated state to all clients
				this.broadcast({ type: 'get-game-state-response', gameState: this.gameState });
				break;

			case 'remove-player':
				// Only allow the admin to remove players
				if (parsedMsg.playerId !== this.gameState.startedById) {
					ws.send(JSON.stringify({ type: 'message', data: 'Only the game admin can remove players.' }));
					break;
				}

				// Find the player to remove
				const playerToRemoveIndex = this.gameState.players.findIndex((p) => p.id === parsedMsg.playerIdToRemove);
				if (playerToRemoveIndex === -1) {
					ws.send(JSON.stringify({ type: 'message', data: 'Player not found.' }));
					break;
				}

				// Get the player details for notification
				const playerToRemove = this.gameState.players[playerToRemoveIndex];
				const playerName = playerToRemove.name;

				// Check if player being removed is the current player
				const isCurrentPlayer = playerToRemove.isCurrentTurn;

				// Remove the player from the players array
				this.gameState.players.splice(playerToRemoveIndex, 1);

				// If there are no players left, reset the game state
				if (this.gameState.players.length === 0) {
					this.gameState.phase = 'lobby';
					this.gameState.currentPlayerIndex = 0;
				} else {
					// If the removed player was the current player, adjust current player index
					if (isCurrentPlayer) {
						// Set to first player if index is now out of bounds
						if (this.gameState.currentPlayerIndex >= this.gameState.players.length) {
							this.gameState.currentPlayerIndex = 0;
						}
						// Update the current player's flag
						this.gameState.players[this.gameState.currentPlayerIndex].isCurrentTurn = true;
					} else if (playerToRemoveIndex < this.gameState.currentPlayerIndex) {
						// Adjust current player index if removed player was before current player
						this.gameState.currentPlayerIndex--;
					}
				}

				// Remove from connected players array
				const connectedPlayerIndex = this.gameState.connectedPlayers.indexOf(parsedMsg.playerIdToRemove);
				if (connectedPlayerIndex !== -1) {
					this.gameState.connectedPlayers.splice(connectedPlayerIndex, 1);
				}

				// Save the updated game state
				await this.saveGameState();

				// Notify all clients about the player removal
				this.broadcast({
					type: 'message',
					data: `Admin removed ${playerName} from the game.`,
				});

				// Send quit message to the removed player's websocket
				this.ctx.getWebSockets().forEach((clientWs) => {
					const attachment = clientWs.deserializeAttachment();
					if (!attachment) return;
					const { id } = attachment;
					if (id === parsedMsg.playerIdToRemove) {
						clientWs.send(
							JSON.stringify({
								type: 'message',
								data: 'You have been removed from the game by the admin.',
							})
						);
						clientWs.send(JSON.stringify({ type: 'quit', gameId: this.gameState.gameId }));
					}
				});

				// Broadcast updated state to all clients
				this.broadcast({ type: 'get-game-state-response', gameState: this.gameState });
				break;

			default:
				if (!this.gameState) {
					console.error('No game session found');
					return;
				}

				const gameSession = this.gameState;

				if (this.gameState.phase !== 'playing') {
					ws.send(JSON.stringify({ type: 'message', data: 'Game has not started yet.' }));
					break;
				}

				if (parsedMsg.type === 'add-word') {
					if (gameSession.players[gameSession.currentPlayerIndex].id !== parsedMsg.playerId) {
						ws.send(JSON.stringify({ type: 'message', data: 'Not your turn!' }));
						return;
					}

					// Extract only the first word if multiple words are submitted
					const firstWord = parsedMsg.word.trim().split(/\s+/)[0];

					// Find player name for the word author
					const author = gameSession.players.find((p) => p.id === parsedMsg.playerId);
					if (!author) {
						ws.send(JSON.stringify({ type: 'message', data: 'Player not found!' }));
						return;
					}

					// Create new word info object
					const wordInfo: WordInfo = {
						text: firstWord,
						authorId: parsedMsg.playerId,
						authorName: author.name,
						addedAt: new Date().toISOString(),
						isRequired: false,
					};

					// Check if the word is one of the required words
					// Remove punctuation when checking to allow for words with punctuation
					const wordWithoutPunctuation = firstWord.replace(/[.,!?;:'"()[\]{}]/g, '').toLowerCase();

					gameSession.requiredWords.forEach((requiredWord, index) => {
						// If already matched, keep it matched
						if (gameSession.hasRequiredWords[index]) {
							return;
						}

						// Check if the word (without punctuation) matches the required word
						if (wordWithoutPunctuation === requiredWord.toLowerCase()) {
							gameSession.hasRequiredWords[index] = true;
							wordInfo.isRequired = true;
							wordInfo.matchedRequiredWordIndex = index;
						}
					});

					// Add the word to the game state
					gameSession.words.push(wordInfo);

					// Move to next player using our helper method (which handles the timer)
					await this.advanceToNextPlayer(gameSession);

					// Check if game is complete - all required words used AND sentence ends with punctuation
					const allRequiredWordsUsed = gameSession.hasRequiredWords.every(Boolean);
					const lastWord = gameSession.words[gameSession.words.length - 1]?.text || '';
					const endsWithPunctuation = /[.!?]$/.test(lastWord);

					if (allRequiredWordsUsed && endsWithPunctuation) {
						gameSession.phase = 'complete';
						// Create sentence array from word info objects
						const sentence = gameSession.words.map((w) => w.text);
						this.broadcast({ type: 'game-complete', sentence });
						gameSession.endedAt = new Date().toISOString();
					} else if (allRequiredWordsUsed && !endsWithPunctuation) {
						// All words are used but no punctuation yet - inform players
						ws.send(
							JSON.stringify({
								type: 'message',
								data: 'All required words used! Add punctuation (., !, ?) at the end of a word to complete the game.',
							})
						);
					}

					// Save the updated game state
					await this.saveGameState();

					ws.serializeAttachment({ id: parsedMsg.playerId });
					this.broadcast({ type: 'get-game-state-response', gameState: gameSession });
				} else if (parsedMsg.type === 'message') {
					this.broadcast(parsedMsg);
				}
				break;
		}
	}

	async webSocketClose(ws: WebSocket) {
		const attachment = ws.deserializeAttachment();
		if (!attachment) return;

		const { id } = attachment;

		// Remove player from connected players list
		if (id && this.gameState.connectedPlayers.includes(id)) {
			this.gameState.connectedPlayers = this.gameState.connectedPlayers.filter((playerId) => playerId !== id);
			await this.saveGameState();
		}

		// Let others know someone disconnected
		this.broadcast({ type: 'get-game-state-response', gameState: this.gameState });
	}

	async closeSessions() {
		this.ctx.getWebSockets().forEach((ws) => ws.close());
	}

	async fetch(request: Request) {
		const url = new URL(request.url);
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		this.ctx.acceptWebSocket(server);
		const gameId = url.searchParams.get('gameId');
		const playerId = url.searchParams.get('playerId');
		const playerName = url.searchParams.get('playerName');

		// Get turn time limit - parse as int and default to 0 (no limit)
		const turnTimeLimitParam = url.searchParams.get('turnTimeLimit');
		console.log('Turn time limit parameter:', turnTimeLimitParam);

		const turnTimeLimit = parseInt(turnTimeLimitParam || '0', 10);
		console.log('Parsed turn time limit:', turnTimeLimit);

		// Get required words from URL, filter out empty strings, and ensure we have at least 2 valid words
		let requiredWords =
			url.searchParams
				.get('requiredWords')
				?.split(',')
				.filter((word) => word.trim()) || [];
		// Decode URI components in case they were encoded
		requiredWords = requiredWords.map((word) => decodeURIComponent(word));

		if (requiredWords.length < 2) {
			requiredWords = ['cheese', 'pants']; // Default words if not enough valid words provided
		}

		if (!gameId || !playerId || !playerName) {
			return new Response('Missing required parameters', { status: 400 });
		}

		// If this is a new game (no players yet), then initialize it
		if (this.gameState.players.length === 0) {
			// Set Id and Default Position
			this.gameState = {
				gameId,
				players: [],
				connectedPlayers: [],
				words: [],
				startedAt: new Date().toISOString(),
				endedAt: null,
				startedById: null,
				requiredWords,
				hasRequiredWords: new Array(requiredWords.length).fill(false),
				currentPlayerIndex: 0,
				phase: 'lobby',
				turnTimeLimit, // Set from URL parameter
				lastTurnStartTime: null,
			};
			console.log('Game initialized with turn time limit:', this.gameState.turnTimeLimit);
			await this.saveGameState();
		} else {
			console.log('Game already exists with turn time limit:', this.gameState.turnTimeLimit);
		}

		// Serialize player ID as attachment for later use
		server.serializeAttachment({ id: playerId });

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	// Helper method to advance to the next player's turn
	async advanceToNextPlayer(gameSession: GameState) {
		// Move to next player
		gameSession.players[gameSession.currentPlayerIndex].isCurrentTurn = false;
		gameSession.currentPlayerIndex = (gameSession.currentPlayerIndex + 1) % gameSession.players.length;
		gameSession.players[gameSession.currentPlayerIndex].isCurrentTurn = true;

		// Update the turn start time only if there's a time limit
		if (gameSession.turnTimeLimit > 0) {
			gameSession.lastTurnStartTime = new Date().toISOString();
		}

		// Save state and broadcast updates
		await this.saveGameState();
		this.broadcast({ type: 'get-game-state-response', gameState: gameSession });
	}
}

export default {
	async fetch(request, env) {
		if (request.url.match('/ws')) {
			const upgradeHeader = request.headers.get('Upgrade');
			if (!upgradeHeader || upgradeHeader !== 'websocket') {
				return new Response('Durable Object expected Upgrade: websocket', {
					status: 426,
				});
			}
			const url = new URL(request.url);
			const gameId = url.searchParams.get('gameId');
			if (!gameId) {
				return new Response('Missing gameId', { status: 400 });
			}
			const id = env.CHEESE_PANTS_2.idFromName(gameId);
			const stub = env.CHEESE_PANTS_2.get(id);
			return stub.fetch(request);
		}
		return new Response(null, {
			status: 400,
			statusText: 'Bad Request',
			headers: {
				'Content-Type': 'text/plain',
			},
		});
	},
} satisfies ExportedHandler<Env>;
