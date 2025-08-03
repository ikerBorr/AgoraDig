/**
 * @file server.js
 * @description Servidor principal de la aplicación AgoraDig. Gestiona las conexiones,
 * autenticación de usuarios, registro, y perfiles. Utiliza Express.js
 * para el enrutamiento y Mongoose para la interacción con la base de datos MongoDB.
 * @author CPV05
 */

// =================================================================
//  IMPORTS
// =================================================================

// Módulos nativos de Node.js
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Módulos de NPM (dependencias de terceros)
require('dotenv').config(); // Carga las variables de entorno desde un archivo .env al objeto process.env.
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // Almacenamiento de sesiones en MongoDB.
const bcrypt = require('bcrypt');         // Librería optimizada para el hasheo de contraseñas.
const multer = require('multer');           // Middleware para la subida de archivos (multipart/form-data).
const sharp = require('sharp');             // Librería para el procesamiento y optimización de imágenes.
const rateLimit = require('express-rate-limit'); // Middleware para limitar la tasa de peticiones y prevenir ataques.
const helmet = require('helmet'); // Middleware que establece varias cabeceras HTTP de seguridad.


// =================================================================
//  INITIALIZATION AND CONFIG
// =================================================================
const app = express();
const PORT = process.env.PORT || 5000;

// Valida que las variables de entorno críticas, como el secreto de sesión, estén presentes.
if (!process.env.SESSION_SECRET) {
    console.error('FATAL ERROR: La variable de entorno SESSION_SECRET no está definida.');
    process.exit(1); // Detiene la aplicación si el secreto no está configurado para evitar vulnerabilidades.
}

// Configuración de confianza del proxy. Necesario si la app corre detrás de un proxy inverso (Heroku, Nginx, etc.).
// Permite que express-session y express-rate-limit funcionen correctamente.
app.set('trust proxy', 1);


// =================================================================
//  MIDDLEWARE
// =================================================================

// Aplica el middleware Helmet para establecer cabeceras HTTP seguras por defecto (ej. X-XSS-Protection, Strict-Transport-Security).
app.use(helmet());

// Middleware para parsear el cuerpo de las peticiones con formato JSON.
app.use(express.json());
// Middleware para servir archivos estáticos (imágenes de perfil subidas).
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de la sesión de usuario
const mongoUrl = 'mongodb://localhost:27017/AgoraDig_BD';
app.use(session({
    secret: process.env.SESSION_SECRET,      // Secreto utilizado para firmar la cookie de sesión, cargado desde variables de entorno.
    resave: false,                           // No volver a guardar la sesión si no ha cambiado.
    saveUninitialized: false,                // No crear sesión hasta que algo se almacene.
    store: MongoStore.create({ mongoUrl: mongoUrl }), // Almacenar las sesiones en la base de datos MongoDB.
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24 * 7,     // Duración de la cookie: 7 días.
        secure: process.env.NODE_ENV === 'production', // Asegura que la cookie solo se envíe sobre HTTPS en producción.
        httpOnly: true,                      // Previene que la cookie sea accesible desde el JavaScript del cliente (mitiga ataques XSS).
        sameSite: 'lax'                      // Mitiga ataques de falsificación de petición en sitios cruzados (CSRF).
    }
}));

// Middleware para servir los archivos estáticos del frontend (HTML, CSS, JS).
app.use(express.static(path.join(__dirname, 'public')));

// --- Middlewares de Seguridad (Rate Limiters) ---

/**
 * @description Limitador de peticiones global para mitigar ataques de denegación de servicio (DoS).
 * Limita a 200 peticiones por IP cada 15 minutos.
 */
const DoSLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200,
    message: 'Demasiadas peticiones enviadas, se ha detectado un posible ataque. Por favor, espera unos minutos.',
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * @description Limitador de peticiones más estricto para rutas sensibles (login, registro).
 * Limita a 10 peticiones por IP cada 5 minutos para prevenir ataques de fuerza bruta.
 */
const sensitiveRouteLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiadas peticiones a esta ruta, por favor intente de nuevo más tarde.'
});

// Aplicar el limitador global a todas las peticiones entrantes.
app.use(DoSLimiter);


// =================================================================
//  BD CONNECTION
// =================================================================
mongoose.connect(mongoUrl)
    .then(() => console.log('✅ Conexión a MongoDB realizada'))
    .catch(err => console.error('❌ Error de conexión a MongoDB:', err));


// =================================================================
//  MODELS AND SCHEMAS
// =================================================================

/**
 * @description Esquema de Mongoose para el modelo de Usuario.
 * Define la estructura, tipos de datos y validaciones para los documentos de usuario en la base de datos.
 */
const userSchema = new mongoose.Schema({
    // Información personal del usuario
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },

    // Credenciales y datos de la cuenta
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // `select: false` evita que se devuelva por defecto en las consultas.
    recoveryPIN: { type: String, required: true, select: false, unique: true },
    
    // Información del perfil público
    description: { type: String, trim: true, maxlength: 300, default: '' },
    profilePicturePath: { type: String },

    // Preferencias del usuario
    acceptsPublicity: { type: Boolean, default: false },

    // Metadatos de la cuenta
    role: { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
    userStatus: { type: String, enum: ['active', 'verified', 'banned'], default: 'active' }

}, { 
    // `timestamps: true` añade automáticamente los campos `createdAt` y `updatedAt`.
    timestamps: true
});

const User = mongoose.model('User', userSchema);

/**
 * @description Configuración de Multer para la gestión de subida de archivos.
 * Almacena temporalmente los archivos en el directorio 'uploads/' y limita su tamaño.
 */
const upload = multer({
  dest: 'uploads/', // Directorio temporal de subida.
  limits: {
    fileSize: 2 * 1024 * 1024 // Límite de tamaño de archivo: 2 MB
  }
});


// =================================================================
//  ROUTES
// =================================================================

/**
 * @route   POST /login
 * @description Autentica a un usuario y crea una sesión.
 * @access  Public
 * @param {string} req.body.loginIdentifier - El nombre de usuario o email del usuario.
 * @param {string} req.body.password - La contraseña del usuario.
 * @returns {object} 200 - Mensaje de éxito.
 * @returns {object} 400 - Error de validación, campos faltantes.
 * @returns {object} 401 - Credenciales incorrectas.
 * @returns {object} 500 - Error interno del servidor.
 */
app.post('/login', sensitiveRouteLimiter, async (req, res) => {
    try {
        const { loginIdentifier, password } = req.body;
        const errors = {};

        // --- Validaciones de entrada ---
        if (!loginIdentifier) errors.loginIdentifier = 'El campo de usuario o email es obligatorio.';
        if (!password) errors.password = 'El campo de contraseña es obligatorio.';

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ errors });
        }

        // Buscar usuario por nombre de usuario o email, incluyendo la contraseña explícitamente en el resultado.
        const user = await User.findOne({
            $or: [{ username: loginIdentifier }, { email: loginIdentifier.toLowerCase() }]
        }).select('+password');

        if (!user) {
            return res.status(401).json({ errors: { loginIdentifier: 'El usuario o email no existe.' } });
        }

        // Comparar la contraseña proporcionada con la hasheada en la BD.
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ errors: { password: 'La contraseña es incorrecta.' } });
        }
        
        // Almacenar el ID del usuario en la sesión para mantenerlo autenticado.
        req.session.userId = user._id;

        res.status(200).json({ message: 'Inicio de sesión exitoso.' });

    } catch (error) {
        console.error('Error en /login:', error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

/**
 * @route   POST /register
 * @description Registra un nuevo usuario, incluyendo la subida y procesamiento de una imagen de perfil.
 * @access  Public
 * @param   {object} req.body - Datos del formulario de registro (firstName, lastName, etc.).
 * @param   {file}   req.file - Archivo de imagen de perfil subido.
 * @returns {object} 201 - Mensaje de éxito, ID del nuevo usuario y su PIN de recuperación en texto plano.
 * @returns {object} 400 - Errores de validación o campos faltantes.
 * @returns {object} 409 - Conflicto, el email o usuario ya existen.
 * @returns {object} 413 - El archivo subido es demasiado grande.
 * @returns {object} 500 - Error interno del servidor.
 */
app.post('/register', 
    // 1. Middleware para gestionar la subida del archivo.
    (req, res, next) => {
        upload.single('profilePicture')(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({ message: 'El archivo es demasiado grande. El límite es de 2MB.' });
                }
                return res.status(400).json({ message: `Error al subir el archivo: ${err.message}` });
            } else if (err) {
                return res.status(500).json({ message: `Error desconocido: ${err.message}` });
            }
            // Si no hay errores, pasar al siguiente middleware/controlador.
            next();
        });
    }, 
    // 2. Aplicar el limitador de peticiones para rutas sensibles.
    sensitiveRouteLimiter, 
    // 3. Controlador principal de la ruta.
    async (req, res) => {

    const tempFile = req.file;

    try {
        const {
            firstName, lastName, dateOfBirth,
            username, email, confirmEmail, password, confirmPassword,
            description, acceptsPublicity 
        } = req.body;

        // --- Validaciones de campos ---
        if (!firstName || !lastName || !username || !email || !password || !confirmPassword || !dateOfBirth || !tempFile) {
            if (tempFile) fs.unlinkSync(tempFile.path); // Eliminar archivo temporal si la validación falla.
            return res.status(400).json({ errors: { general: 'Faltan campos por rellenar.' } });
        }
        
        const nameRegex = /^[\p{L}\s]+$/u;
        if (!nameRegex.test(firstName)) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { firstName: 'El nombre solo puede contener letras y espacios.' } });
        }
        if (!nameRegex.test(lastName)) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { lastName: 'Los apellidos solo pueden contener letras y espacios.' } });
        }

        if (username.length < 3 || username.length > 20) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { username: 'El nombre de usuario debe tener entre 3 y 20 caracteres.' } });
        }

        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(email)) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { email: 'Por favor, introduce un formato de email válido.' } });
        }
        if (email !== confirmEmail) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { confirmEmail: 'Los emails no coinciden.' } });
        }

        if (password.length < 6) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { password: 'La contraseña debe tener al menos 6 caracteres.' } });
        }
        if (password !== confirmPassword) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { confirmPassword: 'Las contraseñas no coinciden.' } });
        }

        const birthDate = new Date(dateOfBirth);
        const minDate = new Date(); minDate.setHours(0,0,0,0); minDate.setFullYear(minDate.getFullYear() - 110);
        const maxDate = new Date(); maxDate.setHours(0,0,0,0); maxDate.setFullYear(maxDate.getFullYear() - 10);
        if (isNaN(birthDate.getTime()) || birthDate > maxDate || birthDate < minDate) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { dateOfBirth: 'La fecha de nacimiento proporcionada no es válida o eres demasiado joven para registrarte.' }});
        }
        
        // --- Procesamiento de datos y creación de usuario ---

        // Generar "salt" y hashear la contraseña. Un costo de 12 es un buen balance entre seguridad y rendimiento.
        const salt = await bcrypt.genSalt(12); 
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Generar un PIN de recuperación único y hashearlo.
        const plainTextRecoveryPIN = crypto.randomBytes(8).toString('hex').toUpperCase();
        const hashedRecoveryPIN = await bcrypt.hash(plainTextRecoveryPIN, salt);

        // Crear una nueva instancia del modelo User.
        const newUser = new User({
            firstName, lastName, dateOfBirth, 
            username, email, password: hashedPassword, recoveryPIN: hashedRecoveryPIN,
            description, acceptsPublicity: !!acceptsPublicity,
        });
        await newUser.save(); // Guardar el usuario en la BD.

        // --- Procesamiento y guardado de la imagen de perfil ---

        // Renombrar el archivo con el ID del usuario para asegurar unicidad y fácil acceso.
        const newFileName = `${newUser._id}.webp`;
        const newPath = path.join(__dirname, 'uploads', newFileName);

        // Usar Sharp para redimensionar, convertir a formato .webp y optimizar la imagen.
        await sharp(tempFile.path)
            .resize(500, 500, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(newPath);

        // Eliminar el archivo temporal original subido por multer.
        fs.unlinkSync(tempFile.path);

        // Actualizar el documento del usuario con la ruta de la imagen de perfil.
        newUser.profilePicturePath = `uploads/${newFileName}`;
        await newUser.save();

        res.status(201).json({
            message: '¡Usuario registrado con éxito! Se ha generado un PIN de recuperación único. Anótelo en un lugar seguro para poder recuperar su cuenta en caso de pérdida.',
            userId: newUser._id,
            // Se devuelve el PIN en texto plano UNA ÚNICA VEZ para que el cliente lo muestre al usuario.
            // El frontend debe encargarse de que el usuario lo guarde y luego descartarlo.
            recoveryPIN: plainTextRecoveryPIN 
        });

    } catch (error) {
        // Asegurarse de que el archivo temporal se elimine en caso de cualquier error en el proceso.
        // Se comprueba si el archivo aún existe antes de intentar borrarlo para evitar errores.
        if (tempFile && fs.existsSync(tempFile.path)) {
            fs.unlinkSync(tempFile.path);
        }

        // --- Manejo de errores específicos ---
        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ errors });
        }

        // Error de clave duplicada de MongoDB (e.g., username o email ya existen).
        if (error.code === 11000) {
            if (error.keyPattern.username) return res.status(409).json({ errors: { username: 'Este nombre de usuario ya existe.' }});
            if (error.keyPattern.email) return res.status(409).json({ errors: { email: 'Este email ya está registrado.' }});
            // Es muy improbable, pero si el PIN generado aleatoriamente ya existe, se informa como error del servidor.
            if (error.keyPattern.recoveryPIN) return res.status(500).json({ message: 'Error al generar datos únicos. Inténtalo de nuevo.' });
        }

        console.error('Error en /register:', error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

/**
 * @route   POST /logout
 * @description Cierra la sesión del usuario actual destruyendo la sesión en el servidor.
 * @access  Private (requiere estar autenticado)
 * @returns {object} 200 - Mensaje de éxito.
 * @returns {object} 500 - Si no se pudo destruir la sesión.
 */
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error en /logout:', err);
            return res.status(500).json({ message: 'No se pudo cerrar la sesión.' });
        }
        res.clearCookie('connect.sid'); // Limpia la cookie de sesión del navegador.
        res.status(200).json({ message: 'Sesión cerrada con éxito.' });
    });
});

/**
 * @route   GET /api/profile
 * @description Obtiene los datos del perfil del usuario autenticado.
 * @access  Private (requiere estar autenticado)
 * @returns {object} 200 - Objeto con los datos del perfil del usuario.
 * @returns {object} 401 - Si el usuario no está autenticado.
 * @returns {object} 404 - Si el usuario de la sesión no se encuentra en la BD.
 * @returns {object} 500 - Error interno del servidor.
 */
app.get('/api/profile', async (req, res) => {
    // Verificar si existe una sesión de usuario activa.
    if (!req.session.userId) {
        return res.status(401).json({ message: 'No autenticado. Por favor, inicie sesión.' });
    }

    try {
        // Buscar al usuario por el ID almacenado en la sesión.
        const user = await User.findById(req.session.userId)
            // Seleccionar explícitamente los campos a devolver para no exponer información sensible.
            .select('firstName lastName username email description profilePicturePath role createdAt');

        if (!user) {
            // Si el ID de sesión es válido pero el usuario no existe (ej. fue eliminado), destruir la sesión.
            req.session.destroy();
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        res.status(200).json(user);

    } catch (error) {
        console.error('Error al obtener el perfil del usuario:', error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});


// =================================================================
//  CATCH-ALL AND START SERVER
// =================================================================

/**
 * @description Ruta "catch-all" o comodín. Redirige cualquier petición GET no reconocida
 * a la página principal del frontend (index.html). Esencial para el funcionamiento de Single Page Applications (SPAs).
 */
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// Inicia el servidor para que escuche peticiones en el puerto especificado.
app.listen(PORT, () => { console.log(`🚀 Servidor iniciado en 🌐 ​http://localhost:${PORT} 🌐​`); });