# Sistema de Seguimiento de Progreso en Tiempo Real

Este documento describe la arquitectura y funcionamiento del sistema de seguimiento de progreso en tiempo real implementado para mostrar el avance de los trabajos de scraping a los usuarios.

## 1. Arquitectura General

El sistema utiliza un patrón de polling para actualizar el progreso de los trabajos de scraping en tiempo real, permitiendo a los usuarios ver el avance de sus búsquedas mientras se procesan en segundo plano.

### 1.1 Componentes Principales

- **Frontend**: Componente React que muestra la barra de progreso (`client-page.tsx`)
- **Backend**: API que procesa los trabajos y actualiza el estado (`/api/scraping/{platform}`)
- **Base de Datos**: Almacena el estado y progreso de los trabajos
- **Cola de Trabajos**: QStash para procesamiento asíncrono

### 1.2 Flujo de Datos

1. Usuario inicia una búsqueda
2. Se crea un trabajo en la base de datos con estado "pending"
3. El trabajo se encola en QStash para procesamiento en segundo plano
4. El frontend realiza polling periódico para obtener actualizaciones
5. El backend actualiza el progreso en la base de datos
6. El frontend muestra el progreso actualizado al usuario

## 2. Archivos Clave

### 2.1 Frontend: Visualización del Progreso

**Ruta**: `/app/campaigns/[id]/client-page.tsx`

Este componente cliente es responsable de mostrar el progreso al usuario y actualizar la interfaz en tiempo real.

```typescript
// Inicialización de estados para seguimiento
const [isSearching, setIsSearching] = useState(false);
const [activeJob, setActiveJob] = useState<ScrapingJob | null>(null);
const [progress, setProgress] = useState(0);
const activeJobRef = useRef<ScrapingJob | null>(null);

// Efecto para iniciar el polling
useEffect(() => {
  // Encontrar trabajo activo inicial
  const initialActiveJob = campaign?.scrapingJobs?.find(job => 
    job.status === 'pending' || job.status === 'processing'
  );
  
  setActiveJob(initialActiveJob || null);
  activeJobRef.current = initialActiveJob || null;
  setProgress(initialActiveJob?.progress || 0);

  // Si hay un trabajo activo, iniciar el polling
  if (initialActiveJob) {
    const pollInterval = setInterval(async () => {
      try {
        const currentJob = activeJobRef.current;
        if (!currentJob) {
          clearInterval(pollInterval);
          return;
        }

        // Solicitar actualización del estado
        const response = await fetch(`/api/scraping/${currentJob.platform.toLowerCase()}?jobId=${currentJob.id}`);
        const data = await response.json();
        
        // Actualizar el estado del trabajo
        const updatedJob = {
          ...currentJob,
          status: data.status,
          progress: data.progress || 0
        };
        
        setActiveJob(updatedJob);
        activeJobRef.current = updatedJob;
        setProgress(data.progress || 0);

        // Si el trabajo está completado, detener el polling
        if (['completed', 'error', 'timeout'].includes(data.status)) {
          clearInterval(pollInterval);
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll cada 3 segundos

    return () => clearInterval(pollInterval);
  }
}, [campaign]);

// Renderizado del componente de progreso
{hasActiveJobs ? (
  <div className="flex flex-col items-center gap-4">
    <div className="flex items-center gap-2 text-gray-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>
        {activeJob?.status === 'completed' 
          ? 'Saving results...' 
          : activeJob?.status === 'processing'
          ? `Processing your search... (${progress}%)`
          : 'Starting search...'}
      </span>
    </div>
    <div className="w-full max-w-md space-y-2">
      <Progress value={progress} className="h-1" />
      <p className="text-sm text-gray-500 text-center">
        {progress}% completed
      </p>
    </div>
  </div>
) : (
  // Botón para iniciar búsqueda
)}
```

### 2.2 Backend: API de Estado del Trabajo

**Ruta**: `/app/api/scraping/[platform]/route.ts`

Esta API es responsable de proporcionar actualizaciones sobre el estado y progreso de los trabajos.

```typescript
export async function GET(
  request: Request,
  { params }: { params: { platform: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }
    
    // Obtener el trabajo de la base de datos
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId)
    });
    
    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }
    
    // Devolver el estado actual del trabajo
    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      processedResults: job.processedResults,
      targetResults: job.targetResults,
      error: job.lastError
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}
```

### 2.3 Worker: Procesamiento en Segundo Plano

**Ruta**: `/app/api/qstash/process-scraping/route.ts`

Este worker procesa los trabajos en segundo plano y actualiza el progreso.

```typescript
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { db } from '@/lib/db';
import { scrapingJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ApifyClient } from '@/lib/utils/apify';

async function handler(req: Request) {
  try {
    const { jobId } = await req.json();
    
    // Obtener trabajo de la base de datos
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId)
    });
    
    if (!job) throw new Error('Job not found');
    
    // Actualizar estado a "processing"
    await db.update(scrapingJobs)
      .set({ status: 'processing', progress: 0 })
      .where(eq(scrapingJobs.id, jobId));
    
    // Iniciar procesamiento con Apify
    const apifyClient = new ApifyClient(process.env.APIFY_TOKEN!);
    
    // Ejecutar actor de Apify
    const runResponse = await apifyClient.runActor({
      keywords: job.keywords,
      maxItems: job.targetResults || 1000
    });
    
    // Actualizar progreso periódicamente
    let currentProgress = 0;
    const progressInterval = setInterval(async () => {
      // Simular avance de progreso o consultar estado real
      currentProgress += 5;
      if (currentProgress > 95) currentProgress = 95;
      
      await db.update(scrapingJobs)
        .set({ progress: currentProgress })
        .where(eq(scrapingJobs.id, jobId));
    }, 5000);
    
    // Obtener resultados cuando el actor termine
    const items = await apifyClient.getDatasetItems(runResponse.datasetId!);
    
    // Limpiar intervalo y actualizar estado final
    clearInterval(progressInterval);
    
    // Guardar resultados en la base de datos
    // [Código para guardar resultados]
    
    // Actualizar estado a "completed" con 100% de progreso
    await db.update(scrapingJobs)
      .set({ 
        status: 'completed', 
        progress: 100,
        processedResults: items.length
      })
      .where(eq(scrapingJobs.id, jobId));
    
    return new Response('Job processed successfully');
  } catch (error) {
    console.error('Error processing job:', error);
    
    // Actualizar estado a "error"
    const { jobId } = await req.json();
    await db.update(scrapingJobs)
      .set({ 
        status: 'error', 
        lastError: error instanceof Error ? error.message : 'Unknown error'
      })
      .where(eq(scrapingJobs.id, jobId));
    
    throw error;
  }
}

// Verificar que la petición viene de QStash
export const POST = verifySignatureAppRouter(handler);
```

### 2.4 Cliente Apify: Interacción con API Externa

**Ruta**: `/lib/utils/apify.ts`

Este cliente maneja la comunicación con la API de Apify para el scraping.

```typescript
import { type CreatorResult } from '@/lib/db/schema';

interface ApifyRunOptions {
  keywords: string[];
  maxItems: number;
  location?: string;
}

interface ApifyResponse {
  id: string;
  status: 'SUCCEEDED' | 'FAILED';
  datasetId?: string;
  error?: string;
}

export class ApifyClient {
  private baseUrl = 'https://api.apify.com/v2';
  private actorId = 'apidojo~tiktok-scraper';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async runActor(options: ApifyRunOptions): Promise<ApifyResponse> {
    const response = await fetch(`${this.baseUrl}/acts/${this.actorId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startUrls: options.keywords.map(k => ({
          url: `https://tiktok.com/search?q=${encodeURIComponent(k)}`
        })),
        maxItems: options.maxItems,
        location: options.location || 'US'
      })
    });

    if (!response.ok) {
      throw new Error(`Apify API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getDatasetItems(datasetId: string): Promise<CreatorResult[]> {
    const response = await fetch(`${this.baseUrl}/datasets/${datasetId}/items`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Dataset API error: ${response.statusText}`);
    }

    return response.json();
  }
}
```

## 3. Esquema de Base de Datos

**Ruta**: `/lib/db/schema.ts`

```typescript
// Definición de la tabla de trabajos de scraping
export const scrapingJobs = pgTable('scraping_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  platform: text('platform').notNull(),
  status: text('status').notNull().default('pending'),
  keywords: text('keywords').array(),
  targetUsername: text('target_username'),
  targetResults: integer('target_results'),
  processedResults: integer('processed_results').default(0),
  progress: integer('progress').default(0),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Definición de la tabla de resultados
export const scrapingResults = pgTable('scraping_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => scrapingJobs.id),
  platform: text('platform').notNull(),
  creators: jsonb('creators').$type<PlatformResult[]>(),
  createdAt: timestamp('created_at').defaultNow()
});
```

## 4. Configuración Necesaria

### 4.1 Variables de Entorno

```env
# Supabase (Base de datos)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# QStash (Cola de trabajos)
QSTASH_TOKEN=your_qstash_token
QSTASH_CURRENT_SIGNING_KEY=your_current_signing_key
QSTASH_NEXT_SIGNING_KEY=your_next_signing_key

# Apify (Scraping)
APIFY_TOKEN=your_apify_token

# Vercel
VERCEL_URL=your_vercel_url
```

### 4.2 Dependencias

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "@upstash/qstash": "^1.x",
    "drizzle-orm": "^0.x",
    "lucide-react": "^0.x",
    "next": "^14.x",
    "react": "^18.x"
  }
}
```

## 5. Cálculo del Porcentaje de Progreso

El porcentaje de progreso se calcula de diferentes maneras dependiendo del tipo de trabajo:

### 5.1 Trabajos de Búsqueda por Palabra Clave

Para trabajos de búsqueda por palabra clave, el progreso se basa en la cantidad de resultados procesados en relación con el objetivo:

```typescript
// En el worker de procesamiento
const progress = Math.floor((processedResults / targetResults) * 100);
```

### 5.2 Trabajos de Búsqueda de Similares

Para trabajos de búsqueda de creadores similares, el progreso se basa en etapas completadas:

```typescript
// Etapas del proceso
const stages = [
  'initializing',   // 0%
  'fetching_profile', // 20%
  'analyzing',      // 40%
  'searching',      // 60%
  'processing',     // 80%
  'completed'       // 100%
];

// Cálculo del progreso basado en la etapa actual
const currentStageIndex = stages.indexOf(currentStage);
const progress = Math.floor((currentStageIndex / (stages.length - 1)) * 100);
```

### 5.3 Actualización en Tiempo Real

El progreso se actualiza en la base de datos y se recupera mediante polling:

1. El worker actualiza el campo `progress` en la tabla `scrapingJobs`
2. El frontend realiza polling a la API cada 3 segundos
3. La API devuelve el valor actual del campo `progress`
4. El frontend actualiza la barra de progreso con el valor recibido

## 6. Manejo de Errores

El sistema incluye un manejo robusto de errores:

```typescript
try {
  // Código de procesamiento
} catch (error) {
  // Actualizar estado del trabajo a "error"
  await db.update(scrapingJobs)
    .set({ 
      status: 'error', 
      lastError: error instanceof Error ? error.message : 'Unknown error'
    })
    .where(eq(scrapingJobs.id, jobId));
  
  // Mostrar error en la interfaz
  console.error('Error processing job:', error);
}
```

## 7. Flujo Completo

1. **Inicio del Trabajo**:
   - Usuario hace clic en "Start Search"
   - Se crea un trabajo con estado "pending" y progreso 0%
   - Se encola en QStash para procesamiento

2. **Procesamiento**:
   - QStash ejecuta el worker
   - El worker actualiza el estado a "processing"
   - Se inicia el actor de Apify
   - Se actualiza el progreso periódicamente

3. **Polling del Cliente**:
   - El componente cliente inicia polling cada 3 segundos
   - Solicita el estado actual del trabajo
   - Actualiza la interfaz con el progreso recibido

4. **Finalización**:
   - El worker detecta que el actor ha terminado
   - Procesa y guarda los resultados
   - Actualiza el estado a "completed" y progreso a 100%
   - El cliente detecta el estado "completed" y recarga la página

## 8. Consideraciones de Rendimiento

- El intervalo de polling (3 segundos) está optimizado para equilibrar la experiencia del usuario y la carga del servidor
- El sistema utiliza referencias para evitar problemas con efectos y cierres en React
- Se implementa un timeout para recargar la página después de completar el trabajo

## 9. Extensibilidad

El sistema está diseñado para ser extensible:

- Soporte para múltiples plataformas mediante el parámetro dinámico `[platform]`
- Estructura modular que permite añadir nuevos tipos de trabajos
- Separación clara entre frontend, API y procesamiento en segundo plano
