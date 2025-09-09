# ÁGORA DIG

¡Bienvenido a Ágora Dig! Un espacio abierto para el debate, la consulta y el intercambio de ideas. Este proyecto es un foro web moderno y dinámico donde los usuarios pueden publicar sus comentarios, dudas y conocimientos en un entorno colaborativo.


## Descripción

**Ágora Dig** es una plataforma web que funciona como un foro de discusión. El objetivo es crear una comunidad donde los usuarios puedan registrarse, crear hilos de debate, publicar comentarios y responder a las dudas de otros. La inspiración detrás del nombre es el "Ágora" de la antigua Grecia, que era el centro de la vida social y política, un lugar para la discusión y el intercambio de ideas.


## Características Principales

* **Gestión de usuarios:** Sistema completo de registro e inicio de sesión.
* **Perfiles de usuario:** Cada miembro tendrá un perfil personalizable.
* **Creación de hilos:** Los usuarios pueden iniciar nuevos temas de discusión organizados por categorías.
* **Publicación de comentarios:** Posibilidad de responder en los hilos para fomentar el debate.
* **Búsqueda avanzada:** Un motor de búsqueda para encontrar fácilmente temas o comentarios específicos.
* **Moderación:** Herramientas para que los administradores puedan gestionar el contenido y mantener un ambiente respetuoso.


## Instalación y Puesta en Marcha

Para ejecutar este proyecto en tu entorno local con Docker:

1.	Asegúrate de tener instalados Docker y Docker Compose.
2.	Desde la carpeta raíz del proyecto, construye e inicia los servicios en segundo plano:

    ```bash
    docker compose -d --build
    ```
3. Verifica que los contenedores estén corriendo:
    
    ```bash
    docker compose ps
    ```
4.	Abre tu navegador y accede a la aplicación en:
[http://localhost:3000](http://localhost:3000/)

> 💡Consejo: si quieres ver los logs en vivo del servidor, ejecuta:
> ```bash
> docker compose logs -f app
> ```


## Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.


**¡Gracias por tu interés en Ágora Dig!**