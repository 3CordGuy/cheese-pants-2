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
	| { type: 'game-complete'; sentence: string[] }
	| { type: 'test-connection' }
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
};

export class CheesePants2RPC extends WorkerEntrypoint<Env> {
	async closeSessions() {
		const id = this.env.CHEESE_PANTS_2.idFromName('globalRoom');
		const stub = this.env.CHEESE_PANTS_2.get(id) as unknown as DurableObjectStub & CheesePants2Methods;
		// Invoking Durable Object RPC method. Same `wrangler dev` session.
		await stub.closeSessions();
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
		};

		// Set up storage operations when state changes
		ctx.blockConcurrencyWhile(async () => {
			// Load existing game state if it exists
			const storedGameState = await ctx.storage.get<GameState>('gameState');
			if (storedGameState) {
				this.gameState = storedGameState;
			}
		});
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

	async webSocketMessage(ws: WebSocket, message: string) {
		if (typeof message !== 'string') return;
		const parsedMsg: WsMessage = JSON.parse(message);

		switch (parsedMsg.type) {
			case 'test-connection':
				// Send back the current game state for debugging

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
					}

					ws.send(JSON.stringify({ type: 'message', data: 'Reconnected to game!' }));
					ws.send(JSON.stringify({ type: 'get-game-state-response', gameState: this.gameState }));
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

					// Find player name for the word author
					const author = gameSession.players.find((p) => p.id === parsedMsg.playerId);
					if (!author) {
						ws.send(JSON.stringify({ type: 'message', data: 'Player not found!' }));
						return;
					}

					// Create new word info object
					const wordInfo: WordInfo = {
						text: parsedMsg.word,
						authorId: parsedMsg.playerId,
						authorName: author.name,
						addedAt: new Date().toISOString(),
						isRequired: false,
					};

					// Check if the word is one of the required words
					// Remove punctuation when checking to allow for words with punctuation
					const wordWithoutPunctuation = parsedMsg.word.replace(/[.,!?;:'"()[\]{}]/g, '').toLowerCase();

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

					// Move to next player
					gameSession.players[gameSession.currentPlayerIndex].isCurrentTurn = false;
					gameSession.currentPlayerIndex = (gameSession.currentPlayerIndex + 1) % gameSession.players.length;
					gameSession.players[gameSession.currentPlayerIndex].isCurrentTurn = true;

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
			};
			await this.saveGameState();
		} else {
			console.log('Game already exists with required words:', this.gameState.requiredWords);
		}

		// Serialize player ID as attachment for later use
		server.serializeAttachment({ id: playerId });

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
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
