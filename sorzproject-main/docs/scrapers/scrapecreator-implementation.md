# Plan de Migración de Apify a ScrapeCreators 🔄

## Contexto del Proyecto

Este documento detalla el plan de migración de un sistema de scraping de TikTok que actualmente usa Apify hacia la plataforma ScrapeCreators.

### Situación Actual
- Sistema desplegado en Vercel (con límite de 10s en endpoints)
- Usa QStash para procesamiento asíncrono
- Base de datos en Supabase
- Búsqueda por keywords en TikTok
- Máximo 10 keywords por búsqueda
- Límite de 1000 resultados por búsqueda

### Objetivo de la Migración
- [X] Reemplazar Apify con ScrapeCreators manteniendo la misma funcionalidad
- [X] Mantener el sistema de colas con QStash por limitaciones de Vercel
- [X] Extraer datos específicos de videos de TikTok:
  - [X] **Información del creador**:
    - [X] Nombre: `author.nickname`
    - [X] ID único: `author.unique_id`
    - [X] URL del avatar: `author.avatar_medium.url_list[0]`
    - [X] Número de seguidores: `author.follower_count`
  - [X] **Hashtags**: Extraídos de `text_extra` donde cada objeto con `type: 1` representa un hashtag
  - [X] **El video con sus estadísticas**
    - [X] URL del video: `share_url`
    - [X] Descripción del video: `desc`
    - [X] Reproducciones: `statistics.play_count`
    - [X] Me gusta: `statistics.digg_count`
    - [X] Comentarios: `statistics.comment_count`
    - [X] Compartidos: `statistics.share_count`
  - [X] **Fecha de creación**: `create_time` (timestamp Unix)

### Notas Técnicas Importantes
- La API de ScrapeCreators utiliza un sistema de paginación basado en cursor, diferente al offset que usaba Apify
- Por ahora solo se procesa una keyword a la vez (la primera del array de keywords)
- Se ha agregado un nuevo campo `cursor` en la tabla `scraping_jobs` para manejar la paginación
- Los resultados mantienen la misma estructura que antes para compatibilidad con el frontend existente

// 2. **Hashtags**: Extraídos de `text_extra` donde cada objeto con `type: 1` representa un hashtag

// 3. **El video con sus estadísticas**
  // 3.1 URL del video: `share_url`
  // 3.2 Descripción del video: `desc`
  // 3.3 Reproducciones: `statistics.play_count`
  // 3.4 Me gusta: `statistics.digg_count`
  // 3.5 Comentarios: `statistics.comment_count`
  // 3.6 Compartidos: `statistics.share_count`

// 4. **Fecha de creación**: `create_time` (timestamp Unix)


### Consideraciones Técnicas
- No se requiere mantener compatibilidad con Apify
- Se debe mantener el procesamiento asíncrono
- Los resultados deben seguir el mismo formato para el frontend
- Se mantiene la arquitectura de Next.js App Router

## Fase 1: Configuración Inicial
- [ ] Configurar variables de entorno en `.env.local`:
  ```
  SCRAPECREATORS_API_KEY=your_api_key
  SCRAPECREATORS_API_URL=https://api.scrapecreators.com/v1
  ```

## Fase 2: Adaptación de API Routes ✅
- [X] Modificar `app/api/scraping/tiktok/route.ts`:
  ```typescript
  export async function POST(req: Request) {
    // 1. Validar usuario
    // 2. Recibir keywords y campaignId
    // 3. Crear job en DB
    // 4. Encolar en QStash
  }
  ```

- [X] Actualizar `app/api/qstash/process-scraping/route.ts`:
  ```typescript
  export async function POST(req: Request) {
    // 1. Recibir jobId de QStash
    // 2. Llamar a ScrapeCreators API
    // 3. Procesar respuesta
    // 4. Actualizar job status
  }
  ```

## Fase 3: Modelo de Datos ✅
- [X] Actualizar `app/models/schema.ts` para nuevos campos:
  ```typescript
  export interface ScrapingResult {
    creatorInfo: {
      name: string;           // author.nickname
      id: string;            // author.unique_id
      avatarUrl: string;     // author.avatar_medium.url_list[0]
      followers: number;     // author.follower_count
    };
    hashtags: string[];      // text_extra[type=1]
    videoStats: {
      url: string;          // share_url
      description: string;  // desc
      plays: number;       // statistics.play_count
      likes: number;      // statistics.digg_count
      comments: number;   // statistics.comment_count
      shares: number;    // statistics.share_count
    };
    createdAt: number;    // create_time
  }
  ```

## Fase 4: Componentes Frontend
- [ ] Actualizar `app/campaigns/keyword-search/page.tsx`:
  ```typescript
  export default function KeywordSearchPage() {
    // Server Component con formulario inicial
  }
  ```

- [ ] Modificar `app/components/keyword-search/search-form.tsx`:
  ```typescript
  'use client'
  export function SearchForm() {
    // Client Component para manejo de formulario
  }
  ```

## Fase 5: Sistema de Polling y Estado
- [ ] Implementar `app/hooks/use-scraping-status.ts`:
  ```typescript
  export function useScrapingStatus(jobId: string) {
    // Hook para polling cada 3 segundos
  }
  ```

## Fase 6: Manejo de Errores y Logging
- [ ] Crear error boundaries por componente
- [ ] Implementar logging detallado
- [ ] Configurar timeouts y retries

## Diagrama de Flujo Actualizado

```mermaid
graph TD
    A[Search Form] -->|Submit| B[/api/scraping/tiktok]
    B -->|Create Job| C[Database]
    B -->|Queue| D[QStash]
    D -->|Process| E[/api/qstash/process-scraping]
    E -->|API Call| F[ScrapeCreators API]
    F -->|Response| E
    E -->|Update| C
    G[Status Hook] -->|Poll| C
    C -->|Results| H[Results Component]
```

## Notas Técnicas

### Endpoints
- POST `/api/scraping/tiktok`: Inicia búsqueda
- POST `/api/qstash/process-scraping`: Procesa con ScrapeCreators
- GET `/api/qstash/check-status`: Verifica estado

### Límites y Timeouts
- Timeout de Vercel: 10 segundos
- Polling interval: 3 segundos
- Máximo tiempo total: 60 minutos

### Seguridad
- API Key solo en backend
- Validación de usuarios
- Rate limiting por IP

### Manejo de Errores
- Retry automático en fallos de API
- Error boundaries en frontend
- Logging en servidor
