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
//  FUNCIONES DE AYUDA
// =================================================================

const DEFAULT_AVATAR_PATH = 'images/default-avatar.webp';

/**
 * Verifica si la ruta de una imagen de perfil existe en el sistema de archivos.
 * Si no existe, devuelve la ruta de la imagen por defecto para evitar enlaces rotos.
 * @param {string} picturePath - La ruta de la imagen guardada en la BD.
 * @returns {string} Una ruta de imagen válida y segura para ser servida al cliente.
 */
function getValidProfilePicturePath(picturePath) {
    if (!picturePath) {
        return DEFAULT_AVATAR_PATH;
    }

    let finalCheckPath;

    if (picturePath.startsWith('uploads/')) {
        finalCheckPath = path.join(__dirname, picturePath);
    } else {
        finalCheckPath = path.join(__dirname, 'public', picturePath);
    }

    if (fs.existsSync(finalCheckPath)) {
        return picturePath;
    }
    
    return DEFAULT_AVATAR_PATH;
}


// =================================================================
//  INITIALIZATION AND CONFIG
// =================================================================
const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.SESSION_SECRET) {
    console.error('FATAL ERROR: La variable de entorno SESSION_SECRET no está definida.');
    process.exit(1);
}

app.set('trust proxy', 1);


// =================================================================
//  MIDDLEWARE
// =================================================================

app.use(helmet());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/AgoraDig_BD';
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUrl }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 14,
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    }
}));

app.use(express.static(path.join(__dirname, 'public')));

/**
 * Middleware para verificar si un usuario autenticado tiene el rol de 'moderator' o 'admin'.
 * Rechaza la petición si el usuario no tiene los privilegios adecuados.
 * @param {import('express').Request} req - Objeto de la petición de Express.
 * @param {import('express').Response} res - Objeto de la respuesta de Express.
 * @param {import('express').NextFunction} next - Función callback para pasar al siguiente middleware.
 */
const isModeratorOrAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.userId).select('role');
        if (user && (user.role === 'admin' || user.role === 'moderator')) {
            req.userRole = user.role; 
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

app.use(DoSLimiter);

/**
 * Middleware para verificar si un usuario está autenticado.
 * Comprueba la existencia de `req.session.userId`. Si no existe, rechaza la
 * petición con un estado 401.
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
    timestamps: true,
});

const User = mongoose.model('User', userSchema);

/**
 * @description Configuración de Multer para la gestión de subida de archivos.
 * Almacena temporalmente los archivos en 'uploads/' y limita su tamaño a 2MB.
 */
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 2 * 1024 * 1024
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

messageSchema.index({ messageStatus: 1, createdAt: -1 });

/** @property {Number} likeCount - Campo virtual que calcula el número de 'likes' en tiempo de ejecución. */
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

        req.session.userId = user._id;

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
 * @param   {object} req.body - Datos del formulario de registro.
 * @param   {Express.Multer.File} req.file - Archivo de imagen de perfil subido.
 * @returns {object} 201 - Éxito con el ID de usuario y el PIN de recuperación.
 * @returns {object} 4xx - Errores de validación, conflicto o tamaño de archivo.
 * @returns {object} 500 - Error del servidor.
 */
app.post('/register',
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
            next();
        });
    },
    sensitiveRouteLimiter,
    async (req, res) => {

    const tempFile = req.file;

    try {
        const {
            firstName, lastName, dateOfBirth,
            username, email, confirmEmail, password, confirmPassword,
            description, acceptsPublicity
        } = req.body;

        const cleanupTempFile = () => {
            if (tempFile && fs.existsSync(tempFile.path)) {
                fs.unlinkSync(tempFile.path);
            }
        };

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

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const plainTextRecoveryPIN = crypto.randomBytes(8).toString('hex').toUpperCase();
        const hashedRecoveryPIN = await bcrypt.hash(plainTextRecoveryPIN, salt);

        const newUser = new User({
            firstName, lastName, dateOfBirth,
            username, email, password: hashedPassword, recoveryPIN: hashedRecoveryPIN,
            description, acceptsPublicity: !!acceptsPublicity,
        });
        await newUser.save();

        const newFileName = `${newUser._id}.webp`;
        const newPath = path.join(__dirname, 'uploads', newFileName);

        await sharp(tempFile.path)
            .resize(500, 500, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(newPath);

        cleanupTempFile();

        newUser.profilePicturePath = `uploads/${newFileName}`;
        await newUser.save();

        res.status(201).json({
            message: '¡Usuario registrado con éxito! Se ha generado un PIN de recuperación único. Anótelo en un lugar seguro para poder recuperar su cuenta en caso de pérdida.',
            userId: newUser._id,
            recoveryPIN: plainTextRecoveryPIN
        });

    } catch (error) {
        if (tempFile && fs.existsSync(tempFile.path)) {
            fs.unlinkSync(tempFile.path);
        }

        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            return res.status(400).json({ errors });
        }

        if (error.code === 11000) {
            if (error.keyPattern.username) return res.status(409).json({ errors: { username: 'Este nombre de usuario ya existe.' }});
            if (error.keyPattern.email) return res.status(409).json({ errors: { email: 'Este email ya está registrado.' }});
            if (error.keyPattern.recoveryPIN) return res.status(500).json({ message: 'Error al generar datos únicos. Inténtalo de nuevo.' });
        }

        console.error('Error en /register:', error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

/**
 * @route   POST /logout
 * @description Cierra la sesión del usuario actual destruyendo la sesión en el servidor.
 * @access  Private (implícito)
 * @returns {object} 200 - Mensaje de éxito.
 * @returns {object} 500 - Error al destruir la sesión.
 */
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error en /logout:', err);
            return res.status(500).json({ message: 'No se pudo cerrar la sesión.' });
        }
        res.clearCookie('connect.sid');
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
app.get('/api/profile', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'No autenticado. Por favor, inicie sesión.' });
    }

    try {
        const user = await User.findById(req.session.userId)
            .select('firstName lastName username email description profilePicturePath role userStatus createdAt');

        if (!user) {
            req.session.destroy();
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

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
            { new: true, runValidators: true }
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
            .populate('sender', 'username profilePicturePath')
            .lean();

        messages = messages.map(message => {
            if (message.sender) {
                message.sender.profilePicturePath = getValidProfilePicturePath(message.sender.profilePicturePath);
            } else {
                message.sender = {
                    username: 'Usuario Eliminado',
                    profilePicturePath: DEFAULT_AVATAR_PATH
                };
            }
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

        const user = await User.findById(req.session.userId).select('userStatus');
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        if (user.userStatus === 'banned') {
            return res.status(403).json({ message: 'Tu cuenta ha sido suspendida. No puedes publicar mensajes.' });
        }

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

        const hasLiked = message.likes.some(like => like.equals(userId));
        let updatedMessage;

        if (hasLiked) {
            updatedMessage = await Message.findByIdAndUpdate(
                messageId,
                { $pull: { likes: userId } },
                { new: true }
            );
        } else {
            updatedMessage = await Message.findByIdAndUpdate(
                messageId,
                { $addToSet: { likes: userId } },
                { new: true }
            );
        }

        res.status(200).json({
            likeCount: updatedMessage.likeCount,
            isLiked: !hasLiked
        });

    } catch (error) {
        console.error('Error en POST /api/messages/:id/like:', error);
        res.status(500).json({ message: 'Error en el servidor al procesar el like.' });
    }
});

/**
 * @route   GET /api/messages/counts
 * @description Obtiene los contadores de likes para una lista de mensajes. Usado para polling.
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
        }).select('_id likes');

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

        if (req.query.include_moderation === 'true' && req.session.userId) {
            const requester = await User.findById(req.session.userId).select('role');
            if (requester && (requester.role === 'admin' || requester.role === 'moderator')) {
                requesterIsModeratorOrAdmin = true;
            }
        }

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
        
        const updateData = {};

        if (strikes !== undefined) {
            const strikesAsNumber = Number(strikes);
            if (isNaN(strikesAsNumber) || strikesAsNumber < 0) {
                return res.status(400).json({ message: 'Los strikes deben ser un número no negativo.' });
            }
            updateData.strikes = strikesAsNumber;
        }

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
 * a la página principal del frontend. Esencial para el funcionamiento de SPAs.
 */
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

app.listen(PORT, () => { console.log(`🚀 Servidor iniciado en 🌐 ​http://localhost:${PORT} 🌐​`); });