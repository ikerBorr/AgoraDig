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

2.  **Genera un Secreto de Sesión**: El `SESSION_SECRET` es una clave única y segura para proteger las sesiones de los usuarios. Para generar una clave robusta, ejecuta el siguiente comando en tu terminal y copia el resultado:
    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```

3.  **Añade las variables al archivo `.env`**: Abre el archivo `.env` y añade el `SESSION_SECRET` generado. 

    ```env
    # .env

    # Clave secreta para firmar las cookies de sesión.
    # Pega aquí el valor generado en el paso anterior.
    SESSION_SECRET=

    ```
    **Importante**: Asegúrate de que el archivo `.env` esté incluido en tu `.gitignore` para no subirlo a ningún repositorio.

## Paso 4: Iniciar el Servidor

1.  Con las dependencias instaladas y el archivo `.env` configurado, ejecuta el siguiente comando en la terminal:
    ```bash
    node server.js
    ```

2.  Si todo ha ido bien, el servidor se estará ejecutando en `http://localhost:5000`.
