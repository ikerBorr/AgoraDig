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

const path = require('path');
const fs = require('fs');
const crypto =require('crypto');

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const multer = require('multer');
const sharp = require('sharp');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');


// =================================================================
//  FUNCIONES DE AYUDA (HELPERS)
// =================================================================

/**
 * @constant {string} DEFAULT_AVATAR_PATH - Ruta a la imagen de perfil por defecto.
 * @description Se usa como fallback cuando un usuario no tiene imagen o la ruta está rota.
 */
const DEFAULT_AVATAR_PATH = 'images/default-avatar.webp';

/**
 * Verifica si la ruta de una imagen de perfil existe en el sistema de archivos.
 * Si no existe, devuelve la ruta de la imagen por defecto para evitar enlaces rotos en el cliente.
 * @param {string} picturePath - La ruta de la imagen guardada en la base de datos del usuario.
 * @returns {string} Una ruta de imagen válida y segura para ser servida al cliente.
 */
function getValidProfilePicturePath(picturePath) {
    // Si la ruta es nula o indefinida, retorna inmediatamente el avatar por defecto.
    if (!picturePath) {
        return DEFAULT_AVATAR_PATH;
    }

    let finalCheckPath;

    // Construye la ruta absoluta para la verificación, considerando si es una subida o un asset público.
    if (picturePath.startsWith('uploads/')) {
        finalCheckPath = path.join(__dirname, picturePath);
    } else {
        finalCheckPath = path.join(__dirname, 'public', picturePath);
    }
    
    // Devuelve la ruta original solo si el archivo existe físicamente.
    if (fs.existsSync(finalCheckPath)) {
        return picturePath;
    }
    
    // Si no, devuelve la ruta del avatar por defecto.
    return DEFAULT_AVATAR_PATH;
}


// =================================================================
//  INITIALIZATION AND CONFIG
// =================================================================
const app = express();
const PORT = process.env.PORT || 5000;

// Medida de seguridad crítica: la aplicación no debe iniciar sin un secreto de sesión.
if (!process.env.SESSION_SECRET) {
    console.error('FATAL ERROR: La variable de entorno SESSION_SECRET no está definida.');
    process.exit(1); // Termina el proceso si la configuración esencial falta.
}

// Confía en el primer proxy. Necesario si la app corre detrás de un reverse proxy (ej. Nginx, Heroku).
app.set('trust proxy', 1);


// =================================================================
//  MIDDLEWARE
// =================================================================

// Aplica cabeceras de seguridad HTTP básicas.
app.use(helmet());
// Parsea cuerpos de petición con formato JSON.
app.use(express.json());
// Sirve estáticamente los archivos subidos (fotos de perfil).
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/AgoraDig_BD';

// Configuración de la sesión de usuario, almacenada en MongoDB para persistencia.
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // No crear sesiones hasta que algo se almacene.
    store: MongoStore.create({ mongoUrl: mongoUrl }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 14, // Duración de la cookie: 14 días.
        secure: process.env.NODE_ENV === 'production', // Usar cookies seguras solo en producción (HTTPS).
        httpOnly: true, // Previene acceso a la cookie desde JavaScript en el cliente.
        sameSite: 'lax' // Protección CSRF básica.
    }
}));

// Sirve los archivos estáticos del frontend (HTML, CSS, JS del cliente).
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Middleware de autorización para verificar si un usuario autenticado tiene el rol de 'moderator' o 'admin'.
 * Rechaza la petición si el usuario no tiene los privilegios adecuados.
 * @param {import('express').Request} req - Objeto de la petición de Express.
 * @param {import('express').Response} res - Objeto de la respuesta de Express.
 * @param {import('express').NextFunction} next - Función callback para pasar al siguiente middleware.
 */
const isModeratorOrAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.userId).select('role');
        if (user && (user.role === 'admin' || user.role === 'moderator')) {
            req.userRole = user.role; // Adjunta el rol a la petición para uso posterior.
            next();
        } else {
            res.status(403).json({ message: 'Acceso denegado. Se requieren privilegios de moderación.' });
        }
    } catch (error) {
        console.error('Error en middleware isModeratorOrAdmin:', error);
        res.status(500).json({ message: 'Error del servidor al verificar los permisos.' });
    }
};

/**
 * @description Limitador de peticiones global para mitigar ataques de denegación de servicio (DoS).
 * Limita a 200 peticiones por IP cada 15 minutos.
 */
const DoSLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
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
    windowMs: 5 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiadas peticiones a esta ruta, por favor intente de nuevo más tarde.'
});

// Aplica el limitador global a todas las peticiones.
app.use(DoSLimiter);

/**
 * Middleware de autenticación para verificar si un usuario tiene una sesión activa.
 * Comprueba la existencia de `req.session.userId`. Si no existe, rechaza la
 * petición con un estado 401 (No Autorizado).
 * @param {import('express').Request} req - Objeto de la petición de Express.
 * @param {import('express').Response} res - Objeto de la respuesta de Express.
 * @param {import('express').NextFunction} next - Función callback para pasar al siguiente middleware.
 */
const isAuthenticated = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Acceso no autorizado. Por favor, inicie sesión.' });
    }
    next();
};

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
 * Define la estructura, tipos de datos y validaciones para los documentos de usuario.
 */
const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    recoveryPIN: { type: String, required: true, select: false, unique: true },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    profilePicturePath: { type: String },
    acceptsPublicity: { type: Boolean, default: false, index: true },
    role: { type: String, enum: ['user', 'admin', 'moderator'], default: 'user', index: true },
    userStatus: { type: String, enum: ['active', 'verified', 'banned'], default: 'active', index: true },
    /** @property {Number} strikes - Contador de infracciones. Usado para moderación. */
    strikes: { type: Number, default: 0 }
}, {
    timestamps: true, // Añade automáticamente los campos createdAt y updatedAt.
});

const User = mongoose.model('User', userSchema);

/**
 * @description Configuración de Multer para la gestión de subida de archivos.
 * Almacena temporalmente los archivos en 'uploads/' y limita su tamaño a 4MB.
 */
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 4 * 1024 * 1024 // 2 Megabytes
  }
});

/**
 * @description Esquema de Mongoose para el modelo de Mensaje.
 * Define la estructura y validaciones para los mensajes del foro.
 */
const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** @property {mongoose.Schema.Types.ObjectId} referencedMessage - ID del mensaje respondido. Nulo si es un mensaje raíz. */
    referencedMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    content: { type: String, required: true, trim: true , maxlength: 1500},
    hashtags: [{ type: String, trim: true, lowercase: true, index: true }],
    likes: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    messageStatus: { type: String, enum: ['active', 'deleted', 'deletedByModerator'], default: 'active', index: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true }, // Asegura que los campos virtuales se incluyan en las respuestas JSON.
    toObject: { virtuals: true }
});

// Índice compuesto para optimizar las consultas más comunes del feed de mensajes.
messageSchema.index({ messageStatus: 1, createdAt: -1 });

/** @property {Number} likeCount - Campo virtual que calcula el número de 'likes' en tiempo de ejecución sin almacenarlo en la BD. */
messageSchema.virtual('likeCount').get(function() { return this.likes.length; });
const Message = mongoose.model('Message', messageSchema);


// =================================================================
//  ROUTES
// =================================================================

/**
 * @route   POST /login
 * @description Autentica a un usuario y crea una sesión.
 * @access  Public
 * @param {object} req.body - Cuerpo de la petición.
 * @param {string} req.body.loginIdentifier - El nombre de usuario o email.
 * @param {string} req.body.password - La contraseña.
 * @returns {object} 200 - Mensaje de éxito.
 * @returns {object} 400 - Errores de validación.
 * @returns {object} 401 - Credenciales incorrectas.
 * @returns {object} 500 - Error del servidor.
 */
app.post('/login', sensitiveRouteLimiter, async (req, res) => {
    try {
        const { loginIdentifier, password } = req.body;
        const errors = {};

        if (!loginIdentifier) errors.loginIdentifier = 'El campo de usuario o email es obligatorio.';
        if (!password) errors.password = 'El campo de contraseña es obligatorio.';

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ errors });
        }

        const user = await User.findOne({
            $or: [{ username: loginIdentifier }, { email: loginIdentifier.toLowerCase() }]
        }).select('+password');

        if (!user) {
            return res.status(401).json({ errors: { loginIdentifier: 'El usuario o email no existe.' } });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ errors: { password: 'La contraseña es incorrecta.' } });
        }

        req.session.userId = user._id; // Crea la sesión para el usuario.

        res.status(200).json({ message: 'Inicio de sesión exitoso.' });

    } catch (error) {
        console.error('Error en /login:', error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

/**
 * @route   POST /register
 * @description Registra un nuevo usuario, incluyendo la subida y procesamiento de imagen de perfil.
 * @access  Public
 * @param   {object} req.body - Datos del formulario de registro (multipart/form-data).
 * @param   {Express.Multer.File} req.file - Archivo de imagen de perfil subido.
 * @returns {object} 201 - Éxito con el ID de usuario y el PIN de recuperación.
 * @returns {object} 4xx - Errores de validación, conflicto o tamaño de archivo.
 * @returns {object} 500 - Error del servidor.
 */
app.post('/register',
    // El limitador de peticiones se aplica ANTES de procesar el archivo para prevenir DoS con subidas de archivos.
    sensitiveRouteLimiter,
    // Middleware de Multer para manejar la subida del archivo.
    (req, res, next) => {
        upload.single('profilePicture')(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({ message: 'El archivo es demasiado grande. El límite es de 4MB.' });
                }
                return res.status(400).json({ message: `Error al subir el archivo: ${err.message}` });
            } else if (err) {
                return res.status(500).json({ message: `Error desconocido: ${err.message}` });
            }
            next();
        });
    },
    // Controlador principal de la ruta.
    async (req, res) => {

    const tempFile = req.file;

    try {
        const {
            firstName, lastName, dateOfBirth,
            username, email, confirmEmail, password, confirmPassword,
            description, acceptsPublicity
        } = req.body;

        // Función auxiliar para limpiar el archivo temporal en caso de error.
        const cleanupTempFile = () => {
            if (tempFile && fs.existsSync(tempFile.path)) {
                fs.unlinkSync(tempFile.path);
            }
        };

        // --- Inicio de la Validación de Datos ---
        if (!firstName || !lastName || !username || !email || !password || !confirmPassword || !dateOfBirth || !tempFile) {
            cleanupTempFile();
            return res.status(400).json({ errors: { general: 'Faltan campos por rellenar.' } });
        }

        const nameRegex = /^[\p{L}\s]+$/u;
        if (!nameRegex.test(firstName)) {
            cleanupTempFile();
            return res.status(400).json({ errors: { firstName: 'El nombre solo puede contener letras y espacios.' } });
        }
        if (!nameRegex.test(lastName)) {
            cleanupTempFile();
            return res.status(400).json({ errors: { lastName: 'Los apellidos solo pueden contener letras y espacios.' } });
        }

        if (username.length < 3 || username.length > 20) {
            cleanupTempFile();
            return res.status(400).json({ errors: { username: 'El nombre de usuario debe tener entre 3 y 20 caracteres.' } });
        }

        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(email)) {
            cleanupTempFile();
            return res.status(400).json({ errors: { email: 'Por favor, introduce un formato de email válido.' } });
        }
        if (email !== confirmEmail) {
            cleanupTempFile();
            return res.status(400).json({ errors: { confirmEmail: 'Los emails no coinciden.' } });
        }

        if (password.length < 6) {
            cleanupTempFile();
            return res.status(400).json({ errors: { password: 'La contraseña debe tener al menos 6 caracteres.' } });
        }
        if (password !== confirmPassword) {
            cleanupTempFile();
            return res.status(400).json({ errors: { confirmPassword: 'Las contraseñas no coinciden.' } });
        }

        const birthDate = new Date(dateOfBirth);
        const minDate = new Date(); minDate.setHours(0,0,0,0); minDate.setFullYear(minDate.getFullYear() - 110);
        const maxDate = new Date(); maxDate.setHours(0,0,0,0); maxDate.setFullYear(maxDate.getFullYear() - 10);
        if (isNaN(birthDate.getTime()) || birthDate > maxDate || birthDate < minDate) {
            cleanupTempFile();
            return res.status(400).json({ errors: { dateOfBirth: 'La fecha de nacimiento proporcionada no es válida o eres demasiado joven para registrarte.' }});
        }
        // --- Fin de la Validación ---

        // Hashing de la contraseña y el PIN de recuperación.
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const plainTextRecoveryPIN = crypto.randomBytes(8).toString('hex').toUpperCase();
        const hashedRecoveryPIN = await bcrypt.hash(plainTextRecoveryPIN, salt);

        // Creación del nuevo usuario en la base de datos.
        const newUser = new User({
            firstName, lastName, dateOfBirth,
            username, email, password: hashedPassword, recoveryPIN: hashedRecoveryPIN,
            description, acceptsPublicity: !!acceptsPublicity,
        });
        await newUser.save();

        // Procesamiento de la imagen de perfil: redimensionar y convertir a WebP.
        const newFileName = `${newUser._id}.webp`;
        const newPath = path.join(__dirname, 'uploads', newFileName);

        await sharp(tempFile.path)
            .resize(500, 500, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(newPath);

        cleanupTempFile(); // Elimina el archivo temporal original.

        // Actualiza el usuario con la ruta de su nueva foto de perfil.
        newUser.profilePicturePath = `uploads/${newFileName}`;
        await newUser.save();

        // Envía la respuesta de éxito.
        res.status(201).json({
            message: '¡Usuario registrado con éxito! Se ha generado un PIN de recuperación único. Anótelo en un lugar seguro para poder recuperar su cuenta en caso de pérdida.',
            userId: newUser._id,
            recoveryPIN: plainTextRecoveryPIN
        });

    } catch (error) {
        // Limpia el archivo temporal si se produce un error en cualquier punto.
        if (tempFile && fs.existsSync(tempFile.path)) {
            fs.unlinkSync(tempFile.path);
        }
        
        // Manejo de errores de validación de Mongoose.
        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ errors });
        }
        
        // Manejo de errores de duplicidad (código 11000 de MongoDB).
        if (error.code === 11000) {
            // Se unifica el mensaje para evitar la enumeración de usuarios/emails.
            if (error.keyPattern.username || error.keyPattern.email) {
                 return res.status(409).json({ errors: { general: 'El nombre de usuario o el email ya están en uso. Por favor, elige otros diferentes.' }});
            }
            // Error poco común pero posible si hay colisión de PIN.
            if (error.keyPattern.recoveryPIN) return res.status(500).json({ message: 'Error al generar datos únicos. Inténtalo de nuevo.' });
        }

        console.error('Error en /register:', error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

/**
 * @route   POST /logout
 * @description Cierra la sesión del usuario actual destruyendo la sesión en el servidor.
 * @access  Private (implícito por requerir una sesión para destruir)
 * @returns {object} 200 - Mensaje de éxito.
 * @returns {object} 500 - Error al destruir la sesión.
 */
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error en /logout:', err);
            return res.status(500).json({ message: 'No se pudo cerrar la sesión.' });
        }
        res.clearCookie('connect.sid'); // Limpia la cookie de sesión del cliente.
        res.status(200).json({ message: 'Sesión cerrada con éxito.' });
    });
});


// =================================================================
//  API ROUTES
// =================================================================

/**
 * @route   GET /api/profile
 * @description Obtiene los datos del perfil del usuario autenticado.
 * @access  Private
 * @returns {object} 200 - Objeto con los datos del perfil del usuario.
 * @returns {object} 401 - No autenticado.
 * @returns {object} 404 - Usuario no encontrado.
 * @returns {object} 500 - Error del servidor.
 */
app.get('/api/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId)
            .select('firstName lastName username email description profilePicturePath role userStatus createdAt');

        if (!user) {
            // Si el usuario no se encuentra, destruye la sesión corrupta por seguridad.
            req.session.destroy();
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // Asegura que la ruta de la imagen de perfil sea válida.
        user.profilePicturePath = getValidProfilePicturePath(user.profilePicturePath);

        res.status(200).json(user);

    } catch (error) {
        console.error('Error al obtener el perfil del usuario:', error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

/**
 * @route   PATCH /api/profile
 * @description Actualiza el nombre de usuario y/o la descripción del usuario autenticado.
 * @access  Private
 * @param {object} req.body - Cuerpo de la petición.
 * @param {string} [req.body.username] - El nuevo nombre de usuario.
 * @param {string} [req.body.description] - La nueva descripción.
 * @returns {object} 200 - Éxito con los datos del usuario actualizados.
 * @returns {object} 400 - Error de validación.
 * @returns {object} 409 - Conflicto, el username ya existe.
 * @returns {object} 500 - Error del servidor.
 */
app.patch('/api/profile', isAuthenticated, async (req, res) => {
    try {
        const { username, description } = req.body;
        const userId = req.session.userId;

        if (!username && description === undefined) {
            return res.status(400).json({ message: 'No se proporcionaron datos para actualizar.' });
        }
        
        // --- Validación de los datos de entrada ---
        const errors = {};
        if (username && (username.length < 3 || username.length > 20)) {
            errors.username = 'El nombre de usuario debe tener entre 3 y 20 caracteres.';
        }
        if (description && description.length > 300) {
            errors.description = 'La descripción no puede exceder los 300 caracteres.';
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ errors });
        }

        // Verifica si el nuevo nombre de usuario ya está en uso por otro usuario.
        if (username) {
            const existingUser = await User.findOne({ username: username, _id: { $ne: userId } });
            if (existingUser) {
                return res.status(409).json({ errors: { username: 'Este nombre de usuario ya está en uso.' } });
            }
        }

        const updateData = {};
        if (username) updateData.username = username;
        if (description !== undefined) updateData.description = description;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true } // `new: true` devuelve el documento actualizado.
        ).select('firstName lastName username email description profilePicturePath role createdAt');

        if (!updatedUser) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        res.status(200).json({
            message: 'Perfil actualizado con éxito.',
            user: updatedUser
        });

    } catch (error) {
        console.error('Error en PATCH /api/profile:', error);
        if (error.name === 'ValidationError') {
            const validationErrors = {};
            for (let field in error.errors) {
                validationErrors[field] = error.errors[field].message;
            }
            return res.status(400).json({ errors: validationErrors });
        }
        res.status(500).json({ message: 'Error en el servidor al actualizar el perfil.' });
    }
});

/**
 * @route   GET /api/messages
 * @description Obtiene una lista paginada de mensajes activos.
 * @access  Public
 * @param {object} req.query - Parámetros de la consulta.
 * @param {number} [req.query.page=1] - El número de página a obtener.
 * @param {number} [req.query.limit=10] - El número de mensajes por página.
 * @returns {object} 200 - Objeto con mensajes e información de paginación.
 * @returns {object} 500 - Error del servidor.
 */
app.get('/api/messages', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        let messages = await Message.find({ messageStatus: 'active' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('sender', 'username profilePicturePath') // Obtiene datos del autor.
            .lean(); // Usa .lean() para obtener objetos JS planos, más rápido para lectura.

        messages = messages.map(message => {
            // Maneja el caso de que el usuario emisor haya sido eliminado.
            if (message.sender) {
                message.sender.profilePicturePath = getValidProfilePicturePath(message.sender.profilePicturePath);
            } else {
                message.sender = {
                    username: 'Usuario Eliminado',
                    profilePicturePath: DEFAULT_AVATAR_PATH
                };
            }
            // Añade un campo booleano `isLiked` para que el frontend sepa si mostrar el like como activo.
            const isLiked = req.session.userId ? message.likes.some(like => like.toString() === req.session.userId.toString()) : false;

            return { ...message, isLiked };
        });

        const totalMessages = await Message.countDocuments({ messageStatus: 'active' });

        res.status(200).json({
            messages,
            totalPages: Math.ceil(totalMessages / limit),
            currentPage: page
        });

    } catch (error) {
        console.error('Error en GET /api/messages:', error);
        res.status(500).json({ message: 'Error en el servidor al obtener los mensajes.' });
    }
});

/**
 * @route   POST /api/messages
 * @description Crea un nuevo mensaje en el foro.
 * @access  Private
 * @param {object} req.body - Cuerpo de la petición.
 * @param {string} req.body.title - El título del mensaje.
 * @param {string} req.body.content - El contenido del mensaje.
 * @param {string} [req.body.hashtags] - Cadena con hashtags (ej: "#tag1 #tag2").
 * @returns {object} 201 - El mensaje recién creado.
 * @returns {object} 400 - Error de validación.
 * @returns {object} 403 - Usuario baneado.
 * @returns {object} 500 - Error del servidor.
 */
app.post('/api/messages', isAuthenticated, async (req, res) => {
    try {
        const { title, content, hashtags } = req.body;

        // Comprueba si el usuario está baneado antes de permitirle publicar.
        const user = await User.findById(req.session.userId).select('userStatus');
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        if (user.userStatus === 'banned') {
            return res.status(403).json({ message: 'Tu cuenta ha sido suspendida. No puedes publicar mensajes.' });
        }

        // --- Validación del contenido del mensaje ---
        if (!title || title.trim().length === 0) {
            return res.status(400).json({ message: 'El título es obligatorio.' });
        }
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'El contenido es obligatorio.' });
        }
        if (title.length > 100) {
            return res.status(400).json({ message: 'El título no puede exceder los 100 caracteres.' });
        }
        if (content.length > 1500) {
            return res.status(400).json({ message: 'El contenido no puede exceder los 1500 caracteres.' });
        }

        // Parsea los hashtags de una cadena de texto a un array.
        const parsedHashtags = hashtags ? hashtags.match(/#(\w+)/g)?.map(h => h.substring(1)) || [] : [];

        const newMessage = new Message({
            title,
            content,
            hashtags: parsedHashtags,
            sender: req.session.userId
        });

        await newMessage.save();

        const populatedMessage = await newMessage.populate('sender', 'username profilePicturePath');

        const responseMessage = populatedMessage.toObject();
        responseMessage.sender.profilePicturePath = getValidProfilePicturePath(responseMessage.sender.profilePicturePath);

        res.status(201).json(responseMessage);

    } catch (error) {
        console.error('Error en POST /api/messages:', error);
        res.status(500).json({ message: 'Error en el servidor al crear el mensaje.' });
    }
});

/**
 * @route   POST /api/messages/:id/like
 * @description Añade o quita un "like" de un usuario a un mensaje.
 * @access  Private
 * @param {object} req.params - Parámetros de la ruta.
 * @param {string} req.params.id - El ID del mensaje.
 * @returns {object} 200 - Objeto con el nuevo contador y estado del like.
 * @returns {object} 404 - Mensaje no encontrado.
 * @returns {object} 500 - Error del servidor.
 */
app.post('/api/messages/:id/like', isAuthenticated, async (req, res) => {
    try {
        const messageId = req.params.id;
        const userId = req.session.userId;

        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'Mensaje no encontrado.' });
        }
        
        // Comprueba si el usuario ya ha dado 'like'.
        const hasLiked = message.likes.some(like => like.equals(userId));
        let updatedMessage;

        if (hasLiked) {
            // Si ya le dio like, se lo quita ($pull).
            updatedMessage = await Message.findByIdAndUpdate(
                messageId,
                { $pull: { likes: userId } },
                { new: true }
            );
        } else {
            // Si no le ha dado like, se lo añade ($addToSet para evitar duplicados).
            updatedMessage = await Message.findByIdAndUpdate(
                messageId,
                { $addToSet: { likes: userId } },
                { new: true }
            );
        }

        res.status(200).json({
            likeCount: updatedMessage.likeCount,
            isLiked: !hasLiked // Devuelve el nuevo estado del 'like'.
        });

    } catch (error) {
        console.error('Error en POST /api/messages/:id/like:', error);
        res.status(500).json({ message: 'Error en el servidor al procesar el like.' });
    }
});

/**
 * @route   GET /api/messages/counts
 * @description Obtiene los contadores de likes para una lista de mensajes. Usado para polling desde el frontend.
 * @access  Public
 * @param {object} req.query - Parámetros de la consulta.
 * @param {string} req.query.ids - Una cadena de IDs de mensajes separados por coma.
 * @returns {object} 200 - Un objeto mapeando cada ID de mensaje a su contador de likes.
 * @returns {object} 400 - Si no se proporcionan IDs.
 * @returns {object} 500 - Error del servidor.
 */
app.get('/api/messages/counts', async (req, res) => {
    try {
        const { ids } = req.query;
        if (!ids) {
            return res.status(400).json({ message: 'No se proporcionaron IDs de mensajes.' });
        }

        const messageIds = ids.split(',');

        const messages = await Message.find({
            '_id': { $in: messageIds }
        }).select('_id likes'); // Selecciona solo los campos necesarios para optimizar.

        // Crea un mapa de ID -> likeCount.
        const counts = messages.reduce((acc, msg) => {
            acc[msg._id] = msg.likeCount;
            return acc;
        }, {});

        res.status(200).json(counts);

    } catch (error) {
        console.error('Error en GET /api/messages/counts:', error);
        res.status(500).json({ message: 'Error en el servidor al obtener los contadores.' });
    }
});

/**
 * @route   GET /api/users/username/:username
 * @description Obtiene los datos del perfil PÚBLICO de un usuario. Incluye datos de
 * moderación si el solicitante es admin/moderador y lo solicita explícitamente.
 * @access  Public (con datos privados para roles autorizados)
 * @param {object} req.params - Parámetros de la ruta.
 * @param {string} req.params.username - El nombre de usuario a consultar.
 * @param {object} req.query - Parámetros de la consulta.
 * @param {boolean} [req.query.include_moderation] - Si es `true`, intenta incluir datos de moderación.
 * @returns {object} 200 - Objeto con los datos del perfil del usuario.
 */
app.get('/api/users/username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        let fieldsToSelect = 'firstName lastName username description profilePicturePath createdAt role userStatus';
        let requesterIsModeratorOrAdmin = false;

        // Si se solicita información de moderación y el usuario está logueado, verifica sus permisos.
        if (req.query.include_moderation === 'true' && req.session.userId) {
            const requester = await User.findById(req.session.userId).select('role');
            if (requester && (requester.role === 'admin' || requester.role === 'moderator')) {
                requesterIsModeratorOrAdmin = true;
            }
        }

        // Si tiene permisos, añade los campos de moderación a la consulta.
        if (requesterIsModeratorOrAdmin) {
            fieldsToSelect += ' strikes';
        }
        
        const user = await User.findOne({ username: username }).select(fieldsToSelect);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        user.profilePicturePath = getValidProfilePicturePath(user.profilePicturePath);

        res.status(200).json(user);

    } catch (error) {
        console.error(`Error al obtener el perfil público por username ${req.params.username}:`, error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

/**
 * @route   PATCH /api/users/:username/admin-update
 * @description Actualiza el rol, estado o strikes de un usuario. Requiere privilegios de moderador/admin.
 * @access  Private (Moderator/Admin)
 * @param {object} req.params - Parámetros de la ruta.
 * @param {string} req.params.username - El nombre de usuario a modificar.
 * @param {object} req.body - Cuerpo de la petición.
 * @param {string} [req.body.role] - El nuevo rol (solo admin).
 * @param {string} [req.body.userStatus] - El nuevo estado (solo admin).
 * @param {number} [req.body.strikes] - El nuevo número de strikes (moderador y admin).
 * @returns {object} 200 - El objeto del usuario actualizado.
 */
app.patch('/api/users/:username/admin-update', isAuthenticated, isModeratorOrAdmin, async (req, res) => {
    try {
        const { username } = req.params;
        const { role, strikes, userStatus } = req.body;
        const requesterRole = req.userRole;

        const userToUpdate = await User.findOne({ username: username });
        if (!userToUpdate) {
            return res.status(404).json({ message: 'Usuario a actualizar no encontrado.' });
        }
        
        // --- Controles de Jerarquía y Seguridad ---
        // Previene que un moderador o admin se modifique a sí mismo.
        if (userToUpdate._id.toString() === req.session.userId) {
            return res.status(403).json({ message: 'No puedes realizar acciones de moderación sobre tu propia cuenta.' });
        }
        // Previene que un admin modifique a otro admin.
        if (requesterRole === 'admin' && userToUpdate.role === 'admin') {
            return res.status(403).json({ message: 'Un administrador no puede modificar a otro administrador.' });
        }
        // Previene que un moderador modifique a otros moderadores o a administradores.
        if (requesterRole === 'moderator' && (userToUpdate.role === 'admin' || userToUpdate.role === 'moderator')) {
            return res.status(403).json({ message: 'Los moderadores no tienen permisos para modificar a otros moderadores o administradores.' });
        }
        // --- Fin de los Controles ---

        const updateData = {};

        // Los moderadores y admins pueden actualizar los strikes.
        if (strikes !== undefined) {
            const strikesAsNumber = Number(strikes);
            if (isNaN(strikesAsNumber) || strikesAsNumber < 0) {
                return res.status(400).json({ message: 'Los strikes deben ser un número no negativo.' });
            }
            updateData.strikes = strikesAsNumber;
        }
        
        // Solo los administradores pueden cambiar roles y estados.
        if (requesterRole === 'admin') {
            if (role) {
                const validRoles = ['user', 'moderator', 'admin'];
                if (!validRoles.includes(role)) {
                    return res.status(400).json({ message: 'El rol proporcionado no es válido.' });
                }
                updateData.role = role;
            }
            if (userStatus) {
                const validStatuses = ['active', 'verified', 'banned'];
                if (!validStatuses.includes(userStatus)) {
                    return res.status(400).json({ message: 'El estado proporcionado no es válido.' });
                }
                updateData.userStatus = userStatus;
            }
        }
        
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No se proporcionaron datos válidos para actualizar.' });
        }

        const updatedUser = await User.findOneAndUpdate(
            { username: username },
            { $set: updateData },
            { new: true }
        ).select('firstName lastName username description profilePicturePath createdAt role strikes userStatus');
        
        res.status(200).json({ message: 'Usuario actualizado correctamente.', user: updatedUser });

    } catch (error) {
        console.error(`Error en PATCH /api/users/${req.params.username}/admin-update:`, error);
        res.status(500).json({ message: 'Error en el servidor al actualizar el usuario.' });
    }
});

// =================================================================
//  CATCH-ALL AND START SERVER
// =================================================================

/**
 * @description Ruta "catch-all" que redirige cualquier petición GET no reconocida
 * a la página principal del frontend. Esencial para el funcionamiento de SPAs,
 * ya que permite que el enrutador del lado del cliente maneje las rutas.
 */
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

app.listen(PORT, () => { console.log(`🚀 Servidor iniciado en 🌐 ​http://localhost:${PORT} 🌐​`); });