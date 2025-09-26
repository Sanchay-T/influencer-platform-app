# Implementación de Similar Search para Instagram

## Lista de tareas

### Configuración del entorno
- [X] Agregar variable de entorno `SCRAPECREATORS_INSTAGRAM_API_URL=https://api.scrapecreators.com/v1/instagram/profile`
- [X] Verificar que `SCRAPECREATORS_API_KEY` esté configurada

### Esquema de la base de datos
- [X] Confirmar que `scrapingJobs` tenga campo `targetUsername` para Instagram
- [X] Confirmar compatibilidad del esquema para ambas plataformas

### Endpoint de Instagram
- [X] Implementar POST en `/app/api/scraping/instagram/route.ts`
  - Recibe: `username` y `campaignId`
  - Guarda job en DB con `platform: 'Instagram'`
  - Encola en QStash para procesamiento
- [X] Implementar GET para verificar resultados
  - Recibe: `jobId`
  - Devuelve perfiles similares si están disponibles

### Processor para Similar Search
- [X] Modificar `/app/api/qstash/process-scraping/route.ts` para:
  - Detectar jobs de Instagram (`job.platform === 'Instagram'`)
  - Llamar a ScrapeCreators con el username
  - Extraer perfiles relacionados de la respuesta
  - Guardar resultados en `scrapingResults`

### Estructura de datos de perfiles relacionados
- [X] Almacenar para cada perfil:
  - `id`
  - `username`
  - `full_name`
  - `is_private`
  - `is_verified`
  - `profile_pic_url`

### Pruebas
- [ ] Probar endpoint POST con Postman:
  ```
  POST /api/scraping/instagram
  {
    "username": "steven",
    "campaignId": "123"
  }
  ```
- [ ] Probar endpoint GET con Postman:
  ```
  GET /api/scraping/instagram?jobId=abc123
  ```
- [ ] Verificar respuesta con perfiles relacionados

### Integración (opcional)
- [ ] Integrar con flujo de campañas
- [ ] Actualizar UI para permitir búsqueda por username de Instagram
