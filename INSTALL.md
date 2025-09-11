# Instrucciones para Ejecutar el Servidor Backend

## Paso 1: Instalar Prerrequisitos

1.  **Descarga e instala Node.js**:
    * Visita el sitio web oficial de [Node.js](https://nodejs.org/es/download) y descarga la versión recomendada.
    * Sigue las instrucciones de la web para completar la instalación.

## Paso 2: Instalar Dependencias del Proyecto

1.  Abre la terminal en el directorio raíz del proyecto.

2.  Ejecuta el siguiente comando para instalar todas las dependencias definidas en el `package.json`:
    ```bash
    npm install
    ```

## Paso 3: Configurar Variables de Entorno

El servidor requiere un archivo de configuración para gestionar claves secretas y otros parámetros sin exponerlos directamente en el código.

1.  **Crea el archivo `.env`**: En el directorio raíz del proyecto, crea un nuevo archivo llamado `.env`.

2.  **Añade las variables al archivo `.env`**: Abre el archivo `.env` y añade las variables necesarias. 

    ```env
    # .env

    SESSION_SECRET=""

    MONGODB_URI_USERS=""
    MONGODB_URI_MESSAGES=""

    TURNSTILE_SECRET_KEY=""

    CLOUDINARY_CLOUD_NAME=""
    CLOUDINARY_API_KEY=""
    CLOUDINARY_API_SECRET=""
    ```
    **Importante**: Asegúrate de que el archivo `.env` esté incluido en tu `.gitignore` para no subirlo a ningún repositorio.

## Paso 4: Iniciar el Servidor

1.  Con las dependencias instaladas y el archivo `.env` configurado, ejecuta el siguiente comando en la terminal:
    ```bash
    node server.js
    ```

2.  Si todo ha ido bien, el servidor se estará ejecutando en `http://localhost:5000`.
