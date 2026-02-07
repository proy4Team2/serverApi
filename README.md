# Documentación de la API

## 1. Autenticación
Todas las peticiones a los endpoints de sesiones requieren un **Token de Firebase** válido en el encabezado de autorización.

* **Header:** `Authorization: <Firebase_ID_Token>`

## 6. Registro de Nuevos Usuarios

El servidor permite la creación de una cuenta directamente mediante correo y contraseña, encargándose de la creación en **Firebase Auth** y la persistencia del perfil en **Firestore**.

* **URL:** `/api/auth/register`
* **Método:** `POST`
* **Headers:** * `Content-Type: application/json`

Todos los campos son obligatorios para que el registro.

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `email` | String | Correo electrónico válido del usuario. |
| `password` | String | Contraseña (Mínimo 6 caracteres según reglas de Firebase). |
| `name` | String | Nombre completo que se mostrará en el perfil. |

**Ejemplo de JSON de entrada:**
```json
{
  "email": "estudiante@ejemplo.com",
  "password": "miPassword123",
  "name": "Juan Pérez"
}
```

## 2. Endpoint
Este endpoint recibe el audio del usuario, genera la transcripción y retorna un análisis detallado.

* **URL:** `/api/sessions`
* **Método:** `POST`
* **Tipo de contenido:** `multipart/form-data`

### Inputs
| Campo | Tipo | Ubicación | Descripción |
| :--- | :--- | :--- | :--- |
| `language` | String | Form-data | Idioma del audio: `"en"` o `"es"`. Por defecto `"en"`. |
| `audio` | Archivo (Binary) | Form-data | Archivo de audio original (ej: `.m4a`, `.wav`, `.mp3`). |
| `conversationHistory` | JSON String | Form-data | (Opcional) Array de objetos `{role, text}` para dar contexto a la IA. |

### Outputs
El servidor retorna un objeto con la transcripción y el feedback estructurado de dos expertos virtuales.

```json
{
  "success": true,
  "sessionId": "uuid-v4-generado",
  "data": {
    "transcript": "Texto obtenido del audio",
    "feedback": {
      "oratory_expert": {
        "score": 0,
        "summary": "Resumen del estilo de comunicación (en el idioma solicitado)",
        "strengths": ["Punto fuerte 1", "Punto fuerte 2"],
        "weaknesses": ["Área de mejora 1", "Área de mejora 2"],
        "pacing_feedback": "Análisis de la velocidad (WPM) y fluidez"
      },
      "recruiter_verdict": {
        "passed": false,
        "decision_rationale": "Justificación profesional de la decisión",
        "star_method_check": "Evaluación del uso de Situación, Tarea, Acción y Resultado",
        "soft_skills": ["Habilidad detectada"],
        "red_flags": ["Alerta crítica detectada"]
      },
      "improvement_plan": {
        "immediate_action": "Consejo para aplicar en la próxima respuesta",
        "long_term_advice": "Recomendación para desarrollo profesional"
      }
    }
  }
}
```

### 3. Lógica de Análisis 

#### Experto en Oratoria 
* **Métricas Técnicas**: El servidor calcula automáticamente las **WPM (Palabras por Minuto)** y el porcentaje de pausas basándose en los tiempos y metadatos de Deepgram.
* **Modelos**: Evalúa la conexión entre Datos y Conclusiones (**Modelo Toulmin**) y penaliza el uso excesivo de lenguaje dubitativo o vacilante (ej. "I think", "maybe").

#### Reclutador
* **STAR Method**: Verifica si el candidato estructura sus experiencias mediante el método **STAR** (Situation, Task, Action, Result).
* **Ownership**: Busca el uso de lenguaje proactivo ("Yo hice/implementé") frente a lenguaje pasivo o impersonal.

---

### 4. Otros Endpoints de Utilidad

#### Listar Sesiones del Usuario
* **URL**: `/api/sessions`
* **Método**: `GET`
* **Descripción**: Retorna un historial resumido que incluye `sessionId`, fecha, puntaje de oratoria (`summaryScore`) y el veredicto del reclutador (`summaryVerdict`).

#### Obtener Detalle de Sesión
* **URL**: `/api/sessions/:sessionId`
* **Método**: `GET`
* **Descripción**: Retorna el objeto completo de la sesión, incluyendo métricas técnicas detalladas como la confianza por palabra, duración exacta y el desglose de pausas.

---

### 5. Códigos de Estado

| Código | Nombre | Descripción |
| :--- | :--- | :--- |
| **201** | Created | Sesión procesada, analizada y guardada exitosamente. |
| **400** | Bad Request | Falta el archivo de audio o el historial de conversación tiene un formato JSON inválido. |
| **401** | Unauthorized | El Token de Firebase es inválido, ha expirado o no fue incluido en la cabecera. |
| **404** | Not Found | La sesión especificada no existe en la base de datos o no pertenece al usuario actual. |
| **500** | Internal Server Error | Error crítico en la comunicación con Deepgram, Gemini o Firebase. |