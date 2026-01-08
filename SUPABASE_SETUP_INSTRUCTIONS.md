# 🚀 Instrucciones de Configuración de Supabase

![Supabase Setup Workflow](C:/Users/USUA/.gemini/antigravity/brain/8e63b9b5-2afb-4a82-95e7-fd62037dbdc4/supabase_setup_guide_1767898570408.png)

## Paso 1: Acceder al Editor SQL de Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. En el menú lateral, haz clic en **"SQL Editor"**
3. Haz clic en **"New query"** para crear una nueva consulta

## Paso 2: Ejecutar el Script de Configuración

1. Abre el archivo `supabase_setup.sql` en tu editor
2. **Copia TODO el contenido** del archivo
3. **Pega el contenido** en el editor SQL de Supabase
4. Haz clic en el botón **"Run"** (o presiona `Ctrl+Enter` / `Cmd+Enter`)

## Paso 3: Verificar que Todo Funcionó

Deberías ver mensajes de éxito indicando:
- ✅ Tablas creadas: `global_metrics` y `daily_pulse`
- ✅ Total de registros en `global_metrics`: 1
- ✅ Total de registros en `daily_pulse`: 8

## Paso 4: Verificar tus Credenciales en .env.local

Asegúrate de que tu archivo `.env.local` contenga:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_publica
```

Para obtener estas credenciales:
1. Ve a **Settings** → **API** en Supabase Dashboard
2. Copia la **Project URL** → Pégala en `NEXT_PUBLIC_SUPABASE_URL`
3. Copia la **anon/public key** → Pégala en `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 🔍 Qué Hace Este Script

### Tablas Creadas

#### 1. **global_metrics**
Almacena las métricas principales del portfolio:
- `net_worth`: Patrimonio neto (ej: 225234891 = $225.2M)
- `monthly_growth`: Crecimiento mensual en porcentaje (ej: 12.4%)
- `roi`: Retorno de inversión en porcentaje (ej: 34.2%)
- `target_revenue`: Meta de ingresos (por defecto: $1B)
- `active_projects`: Número de proyectos activos
- `ytd_return`: Retorno del año hasta la fecha

#### 2. **daily_pulse**
Almacena las actualizaciones diarias y feed de actividad:
- `content`: El contenido del mensaje/actualización
- `category`: Categoría ('business', 'networking', 'personal')
- `timestamp`: Fecha y hora de la publicación
- `has_image`: Si tiene imagen adjunta
- `image_url`: URL de la imagen (opcional)

### Características Implementadas

✅ **Row Level Security (RLS)**: Protege tus datos
- Lectura pública para todos
- Escritura solo para usuarios autenticados

✅ **Real-time Subscriptions**: Actualizaciones automáticas
- Los cambios en la base de datos se reflejan instantáneamente en el UI
- Sin necesidad de refrescar la página

✅ **Triggers Automáticos**: 
- `updated_at` se actualiza automáticamente en cada cambio

✅ **Datos de Prueba**: 
- 1 registro de métricas globales con valores realistas
- 8 entradas de ejemplo en el Daily Pulse

## 🔐 Seguridad

Las políticas de RLS están configuradas para:
- **Lectura pública**: Cualquiera puede ver los datos (perfecto para un dashboard público)
- **Escritura autenticada**: Solo usuarios autenticados pueden crear/actualizar/eliminar

Si necesitas hacer el dashboard completamente privado, puedes modificar las políticas después.

## 🐛 Solución de Problemas

### Error: "relation already exists"
- No te preocupes, esto significa que las tablas ya existen
- El script usa `IF NOT EXISTS` para evitar errores

### Error: "permission denied"
- Asegúrate de estar ejecutando el script con privilegios de administrador
- Verifica que estás en el proyecto correcto de Supabase

### No veo datos en el dashboard
1. Verifica que las credenciales en `.env.local` sean correctas
2. Reinicia el servidor de desarrollo (`npm run dev`)
3. Abre las DevTools del navegador y revisa la consola por errores

## ✅ Próximo Paso

Una vez que hayas ejecutado este script exitosamente, podemos continuar con:
1. Crear el archivo `lib/supabase.ts` para inicializar el cliente
2. Actualizar los componentes para usar datos reales de Supabase
3. Implementar las suscripciones en tiempo real

¡Avísame cuando hayas completado la configuración!
