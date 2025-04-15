import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';

export interface CheesePants2Methods {
	closeSessions(): Promise<void>;
}

export type WsMessage =
	| { type: 'message'; data: string }
	| { type: 'quit'; gameId: string }
	| { type: 'join'; gameId: string; playerName: string }
	| { type: 'get-game-state' }
	| { type: 'get-game-state-response'; gameState: GameState }
	| { type: 'add-word'; word: string; playerId: string }
	| { type: 'game-complete'; sentence: string[] };

export type Player = {
	id: string;
	name: string;
	isCurrentTurn: boolean;
};

export type GameState = {
	gameId: string;
	players: Player[];
	connectedPlayers: Player['id'][];
	words: string[];
	startedAt: string; // ISO 8601
	endedAt: string | null; // ISO 8601
	startedBy: string | null;
	requiredWords: string[];
	hasRequiredWords: boolean[];
	currentPlayerIndex: number;
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
	sessions: Map<WebSocket, GameState>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sessions = new Map();
		this.ctx.getWebSockets().forEach((ws) => {
			const meta = ws.deserializeAttachment();
			this.sessions.set(ws, { ...meta });
		});
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
		const session = this.sessions.get(ws);
		if (!session) return;

		switch (parsedMsg.type) {
			case 'join':
				const newPlayer: Player = {
					id: parsedMsg.gameId,
					name: parsedMsg.playerName,
					isCurrentTurn: session.players.length === 0,
				};
				session.players.push(newPlayer);
				session.connectedPlayers.push(newPlayer.id);
				ws.serializeAttachment(session);
				this.broadcast({ type: 'get-game-state-response', gameState: session }, parsedMsg.gameId);
				break;

			case 'get-game-state':
				const wsMessage: WsMessage = { type: 'get-game-state-response', gameState: session };
				ws.send(JSON.stringify(wsMessage));
				break;

			case 'add-word':
				if (session.players[session.currentPlayerIndex].id !== parsedMsg.playerId) {
					ws.send(JSON.stringify({ type: 'message', data: 'Not your turn!' }));
					return;
				}

				session.words.push(parsedMsg.word);

				// Check if the word is one of the required words
				session.requiredWords.forEach((requiredWord, index) => {
					if (parsedMsg.word.toLowerCase() === requiredWord.toLowerCase()) {
						session.hasRequiredWords[index] = true;
					}
				});

				// Move to next player
				session.players[session.currentPlayerIndex].isCurrentTurn = false;
				session.currentPlayerIndex = (session.currentPlayerIndex + 1) % session.players.length;
				session.players[session.currentPlayerIndex].isCurrentTurn = true;

				// Check if game is complete
				if (session.hasRequiredWords.every(Boolean)) {
					this.broadcast({ type: 'game-complete', sentence: session.words });
					session.endedAt = new Date().toISOString();
				}

				this.broadcast({ type: 'get-game-state-response', gameState: session });
				break;

			case 'message':
				this.broadcast(parsedMsg);
				break;

			default:
				break;
		}
	}

	async webSocketClose(ws: WebSocket) {
		const gameId = this.sessions.get(ws)?.gameId;
		if (gameId) {
			this.broadcast({ type: 'quit', gameId });
		}
		this.sessions.delete(ws);
		ws.close();
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
		const requiredWords = url.searchParams.get('requiredWords')?.split(',') || ['cheese', 'pants'];

		if (!gameId) {
			return new Response('Missing gameId', { status: 400 });
		}

		// Set Id and Default Position
		const sessionInitialData: GameState = {
			gameId,
			players: [],
			connectedPlayers: [],
			words: [],
			startedAt: new Date().toISOString(),
			endedAt: null,
			startedBy: null,
			requiredWords,
			hasRequiredWords: new Array(requiredWords.length).fill(false),
			currentPlayerIndex: 0,
		};
		this.sessions.set(server, sessionInitialData);
		this.broadcast({ type: 'join', gameId, playerName: 'Game Master' }, gameId);

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
