import { ApifyClient as OriginalApifyClient } from 'apify-client';
import { type CreatorResult } from '@/lib/db/schema'

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
  }
}

export class ApifyClient {
  private client: OriginalApifyClient;
  private actorId: string;

  constructor(token: string) {
    this.client = new OriginalApifyClient({
      token,
      maxRetries: 8,
      minDelayBetweenRetriesMillis: 500,
      timeoutSecs: 360
    });

    const actorId = process.env.APIFY_ACTOR_ID!;
    if (!actorId) {
      throw new Error('APIFY_ACTOR_ID no está configurado en las variables de entorno');
    }

    // Convertir el ID si es necesario al formato con tilde
    this.actorId = actorId.includes('/') ? actorId.replace('/', '~') : actorId;
    console.log('🎭 Usando actor:', this.actorId);
  }

  private formatSearchUrl(keyword: string): string {
    const encodedKeyword = encodeURIComponent(keyword);
    return `https://www.tiktok.com/search?q=${encodedKeyword}`;
  }

  async startActor(options: ApifyRunOptions): Promise<ApifyRunResponse> {
    try {
      console.log('🚀 Iniciando llamada a Apify API');
      
      // Convertir keywords en URLs de búsqueda
      const searchKeyword = options.keywords.join(' ');
      const input = {
        startUrls: [this.formatSearchUrl(searchKeyword)],
        maxItems: options.maxItems,
        location: options.location || 'US',
        proxyConfiguration: {
          useApifyProxy: true
        },
        offset: options.offset || 0
      };
      
      console.log('📤 Input:', JSON.stringify(input));

      // Solo iniciar el run, no esperar a que termine
      const run = await this.client.actor(this.actorId).start(input);
      
      console.log('✅ Run iniciado:', run);
      return { 
        data: {
          id: run.id,
          actId: run.actId,
          status: run.status as ActorStatus,
          defaultDatasetId: run.defaultDatasetId,
          startedAt: run.startedAt.toISOString(),
          finishedAt: run.finishedAt?.toISOString(),
          statusMessage: run.statusMessage,
          exitCode: run.exitCode
        }
      };

    } catch (error) {
      console.error('❌ Error en Apify:', error);
      throw error;
    }
  }

  async checkRunStatus(runId: string): Promise<ApifyRunResponse['data']> {
    try {
      console.log('🔍 Verificando estado del run:', runId);
      const run = await this.client.run(runId).get();
      console.log('📊 Estado actual:', run.status);
      
      return {
        id: run.id,
        actId: run.actId,
        status: run.status as ActorStatus,
        defaultDatasetId: run.defaultDatasetId,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString(),
        statusMessage: run.statusMessage,
        exitCode: run.exitCode
      };
    } catch (error) {
      console.error('❌ Error verificando run:', error);
      throw error;
    }
  }

  async getDatasetItems(runId: string): Promise<CreatorResult[]> {
    try {
      console.log('📊 Obteniendo items del run:', runId);
      
      // Usar el cliente oficial para obtener los items
      const { items } = await this.client.dataset(runId).listItems();
      
      // Transformar los items al formato CreatorResult
      const results = items
        .filter(item => {
          const i = item as any;
          return (
            i &&
            typeof i === 'object' &&
            i.channel &&
            typeof i.channel === 'object' &&
            typeof i.channel.name === 'string' &&
            typeof i.channel.followers === 'number' &&
            typeof i.channel.url === 'string'
          );
        })
        .map(item => {
          const i = item as any;
          return {
            profile: i.channel.name,
            keywords: [],  // Se llenará después con los keywords del job
            platformName: 'TikTok',
            followers: i.channel.followers,
            region: i.channel.region || 'US',
            profileUrl: i.channel.url,
            creatorCategory: i.hashtags || []
          } satisfies CreatorResult;
        });

      console.log(`✨ Items obtenidos: ${results.length}`);
      return results;
    } catch (error) {
      console.error('❌ Error obteniendo dataset:', error);
      throw error;
    }
  }
}