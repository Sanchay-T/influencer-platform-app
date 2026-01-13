import { ApifyClient as OriginalApifyClient } from 'apify-client';
import { structuredConsole } from '@/lib/logging/console-proxy';
import {
	getNumberProperty,
	getStringProperty,
	isNumber,
	isRecord,
	isString,
	toArray,
	toRecord,
} from '@/lib/utils/type-guards';

interface ApifyRunOptions {
	keywords: string[];
	maxItems: number;
	location?: string;
	offset?: number;
}

type ActorStatus =
	| 'SUCCEEDED'
	| 'FAILED'
	| 'RUNNING'
	| 'READY'
	| 'ABORTING'
	| 'ABORTED'
	| 'TIMING-OUT'
	| 'TIMED-OUT';

const ACTOR_STATUSES: ActorStatus[] = [
	'SUCCEEDED',
	'FAILED',
	'RUNNING',
	'READY',
	'ABORTING',
	'ABORTED',
	'TIMING-OUT',
	'TIMED-OUT',
];

const isActorStatus = (value: unknown): value is ActorStatus =>
	typeof value === 'string' && ACTOR_STATUSES.some((status) => status === value);

type CreatorResult = {
	profile: string;
	keywords: string[];
	platformName: string;
	followers: number;
	region: string;
	profileUrl: string;
	creatorCategory: string[];
};

interface ApifyRunResponse {
	data: {
		id: string;
		actId: string;
		status: ActorStatus;
		defaultDatasetId?: string;
		startedAt: string;
		finishedAt?: string;
		statusMessage?: string;
		exitCode?: number;
	};
}

export class ApifyClient {
	private client: OriginalApifyClient;
	private actorId: string;

	constructor(token: string) {
		this.client = new OriginalApifyClient({
			token,
			maxRetries: 8,
			minDelayBetweenRetriesMillis: 500,
			timeoutSecs: 360,
		});

		const actorId = process.env.APIFY_ACTOR_ID;
		if (!actorId) {
			throw new Error('APIFY_ACTOR_ID no está configurado en las variables de entorno');
		}

		// Convertir el ID si es necesario al formato con tilde
		this.actorId = actorId.includes('/') ? actorId.replace('/', '~') : actorId;
		structuredConsole.log('🎭 Usando actor:', this.actorId);
	}

	private formatSearchUrl(keyword: string): string {
		const encodedKeyword = encodeURIComponent(keyword);
		return `https://www.tiktok.com/search?q=${encodedKeyword}`;
	}

	async startActor(options: ApifyRunOptions): Promise<ApifyRunResponse> {
		try {
			structuredConsole.log('🚀 Iniciando llamada a Apify API');

			// Convertir keywords en URLs de búsqueda
			const searchKeyword = options.keywords.join(' ');
			const input = {
				startUrls: [this.formatSearchUrl(searchKeyword)],
				maxItems: options.maxItems,
				location: options.location || 'US',
				proxyConfiguration: {
					useApifyProxy: true,
				},
				offset: options.offset || 0,
			};

			structuredConsole.log('📤 Input:', JSON.stringify(input));

			// Solo iniciar el run, no esperar a que termine
			const run = await this.client.actor(this.actorId).start(input);

			structuredConsole.log('✅ Run iniciado:', run);
			const status = isActorStatus(run.status) ? run.status : 'FAILED';
			return {
				data: {
					id: run.id,
					actId: run.actId,
					status,
					defaultDatasetId: run.defaultDatasetId,
					startedAt: run.startedAt.toISOString(),
					finishedAt: run.finishedAt?.toISOString(),
					statusMessage: run.statusMessage,
					exitCode: run.exitCode,
				},
			};
		} catch (error) {
			structuredConsole.error('❌ Error en Apify:', error);
			throw error;
		}
	}

	async checkRunStatus(runId: string): Promise<ApifyRunResponse['data']> {
		try {
			structuredConsole.log('🔍 Verificando estado del run:', runId);
			const run = await this.client.run(runId).get();
			if (!run) {
				throw new Error(`Run ${runId} not found`);
			}
			structuredConsole.log('📊 Estado actual:', run.status);

			const status = isActorStatus(run.status) ? run.status : 'FAILED';
			return {
				id: run.id,
				actId: run.actId,
				status,
				defaultDatasetId: run.defaultDatasetId,
				startedAt: run.startedAt.toISOString(),
				finishedAt: run.finishedAt?.toISOString(),
				statusMessage: run.statusMessage,
				exitCode: run.exitCode,
			};
		} catch (error) {
			structuredConsole.error('❌ Error verificando run:', error);
			throw error;
		}
	}

	async getDatasetItems(runId: string): Promise<CreatorResult[]> {
		try {
			structuredConsole.log('📊 Obteniendo items del run:', runId);

			// Usar el cliente oficial para obtener los items
			const { items } = await this.client.dataset(runId).listItems();

			// Transformar los items al formato CreatorResult
			const results = items.flatMap((item) => {
				const record = toRecord(item);
				if (!record) return [];
				const channel = toRecord(record.channel);
				if (!channel) return [];

				const name = getStringProperty(channel, 'name');
				const followers = getNumberProperty(channel, 'followers');
				const url = getStringProperty(channel, 'url');
				if (!name || followers === null || !url) return [];

				const rawHashtags = toArray(record.hashtags);
				const creatorCategory = rawHashtags?.filter((tag) => isString(tag)) ?? [];
				const keywords: string[] = [];

				const region = getStringProperty(channel, 'region') ?? 'US';

				const result: CreatorResult = {
					profile: name,
					keywords,
					platformName: 'TikTok',
					followers,
					region,
					profileUrl: url,
					creatorCategory,
				};

				return [result];
			});

			structuredConsole.log(`✨ Items obtenidos: ${results.length}`);
			return results;
		} catch (error) {
			structuredConsole.error('❌ Error obteniendo dataset:', error);
			throw error;
		}
	}
}
