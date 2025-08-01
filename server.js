// =================================================================
//  IMPORTS
// =================================================================

// Modules of Node.js
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Modules of NPM
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp');
const rateLimit = require('express-rate-limit');


// =================================================================
//  INITIALIZATION AND CONFIG
// =================================================================
const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);


// =================================================================
//  MIDDLEWARE
// =================================================================

// Body parser
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session
const mongoUrl = 'mongodb://localhost:27017/AgoraDig_BD';
app.use(session({
    secret: 'un_secreto_muy_fuerte_y_largo',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: mongoUrl }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }  // 7 days
}));

// Frontend
app.use(express.static(path.join(__dirname, 'public')));

// Security (Rate Limiters)
const DoSLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Demasiadas peticiones enviadas, se ha detectado un posible ataque. Por favor, espera unos minutos.',
    standardHeaders: true,
    legacyHeaders: false
});

// Rate Limiter
const sensitiveRouteLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiadas peticiones a esta ruta, por favor intente de nuevo más tarde.'
});

app.use(DoSLimiter);


// =================================================================
//  BD CONNECTION
// =================================================================
mongoose.connect('mongodb://localhost:27017/AgoraDig_BD')
    .then(() => console.log('✅ Conexión a MongoDB realizada'))
    .catch(err => console.error('❌ Error de conexión a MongoDB:', err));


// =================================================================
//  MODELS AND SCHEMAS
// =================================================================

// Mongoose model
const userSchema = new mongoose.Schema({
    // Personal information
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    dateOfBirth: {
        type: Date,
        required: true 
    },

    // User information
    username: { 
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    recoveryPIN: {
        type: String, 
        required: true,
        select: false ,
        unique: true
    },
    description: {
        type: String,
        trim: true,
        maxlength : 300,
        default: ''
    },
    profilePicturePath: {
        type: String 
    },

    // User preferences
    acceptsPublicity: {
        type: Boolean,
        default: false
    },

    // Metadata
    role: {
        type: String,
        enum: ['user', 'admin', 'moderator'],
        default: 'user'
    },
    userStatus: {
        type: String,
        enum: ['active', 'verified', 'banned'],
        default: 'active'
    }

}, { 
    // Añade automáticamente los campos createdAt y updatedAt
    timestamps: true
});

const User = mongoose.model('User', userSchema);

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 2 * 1024 * 1024 // Límit 2 MB
  }
});


// =================================================================
//  ROUTES
// =================================================================

// Route to login a user
app.post('/login', sensitiveRouteLimiter, async (req, res) => {
    try {
        const { loginIdentifier, password } = req.body;
        const errors = {};

        // --- Validations ---
        if (!loginIdentifier) {
            errors.loginIdentifier = 'El campo de usuario o email es obligatorio.';
        }
        if (!password) {
            errors.password = 'El campo de contraseña es obligatorio.';
        }

        if (Object.keys(errors).length > 0) {
            return res.status(400).json({ errors });
        }

        const user = await User.findOne({
            $or: [
                { username: loginIdentifier },
                { email: loginIdentifier.toLowerCase() }
            ]
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
        console.error(error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// Route to register a new user
app.post('/register', (req, res, next) => {
    upload.single('profilePicture')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ message: 'El archivo es demasiado grande. El límite es de 2MB.' });
            }
            return res.status(400).json({ message: `Error al subir el archivo: ${err.message}` });
        }
        else if (err) {
            return res.status(500).json({ message: `Error desconocido: ${err.message}` });
        }
        next();
    });
}, sensitiveRouteLimiter, async (req, res) => {

    const tempFile = req.file;

    try {
        const {
            firstName,
            lastName,
            dateOfBirth,

            username,
            email,
            confirmEmail,
            password,
            confirmPassword,
            description,

            acceptsPublicity 
        } = req.body;

        // --- Validations ---
        if (!firstName || !lastName || !username || !email || !password || !confirmPassword || !dateOfBirth || !tempFile) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { general: 'Faltan campos por rellenar.' } });
        }
        
        //Name
        const nameRegex = /^[\p{L}\s]+$/u;
        if (!nameRegex.test(firstName)) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { firstName: 'El nombre solo puede contener letras y espacios.' } });
        }
        if (!nameRegex.test(lastName)) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { lastName: 'Los apellidos solo pueden contener letras y espacios.' } });
        }

        // Username
        if (username.length < 3 || username.length > 20) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { username: 'El nombre de usuario debe tener entre 3 y 20 caracteres.' } });
        }

        // Email
        const emailRegex = /\S+@\S+\.\S+/;
        if (!emailRegex.test(email)) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { email: 'Por favor, introduce un formato de email válido.' } });
        }
        if (email !== confirmEmail) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { confirmEmail: 'Los emails no coinciden.' } });
        }

        // Password
        if (password.length < 6) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { password: 'La contraseña debe tener al menos 6 caracteres.' } });
        }
        if (password !== confirmPassword) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { confirmPassword: 'Las contraseñas no coinciden.' } });
        }

        // Birthdate validation
        const birthDate = new Date(dateOfBirth);
        const minDate = new Date();
        minDate.setHours(0, 0, 0, 0);
        minDate.setFullYear(minDate.getFullYear() - 110);
        const maxDate = new Date();
        maxDate.setHours(0, 0, 0, 0);
        maxDate.setFullYear(maxDate.getFullYear() - 6);
        if (isNaN(birthDate.getTime()) || birthDate > maxDate || birthDate < minDate) {
            if (tempFile) fs.unlinkSync(tempFile.path);
            return res.status(400).json({ errors: { dateOfBirth: 'La fecha de nacimiento proporcionada no es válida o eres demasiado joven para registrarte.' }});
        }

        // Password hashing
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Generate a random security pin
        const plainTextRecoveryPIN = crypto.randomBytes(5).toString('hex').toUpperCase();
        const hashedRecoveryPIN = await bcrypt.hash(plainTextRecoveryPIN, salt);

        // Save the user
        const newUser = new User({
            firstName,
            lastName,
            dateOfBirth, 

            username,
            email,
            password: hashedPassword,
            recoveryPIN: hashedRecoveryPIN,
            description,

            acceptsPublicity: !!acceptsPublicity,
        });
        await newUser.save();

        // Save the profile picture
        const newFileName = `${newUser._id}.webp`;
        const newPath = path.join(__dirname, 'uploads', newFileName);

        await sharp(tempFile.path)
            .resize(500, 500, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(newPath);

        fs.unlinkSync(tempFile.path);

        newUser.profilePicturePath = `uploads/${newFileName}`;
        await newUser.save();

        res.status(201).json({
            message: '¡Usuario registrado con éxito!  IMPORTANTE: Este es su PIN de recuperación. Anótelo en un lugar seguro para poder recuperar su cuenta en caso de pérdida.',
            userId: newUser._id,
            recoveryPIN: plainTextRecoveryPIN 
        });

    }
    catch (error) {
        if (tempFile) fs.unlinkSync(tempFile.path); // Delete the temporary file

        if (error.name === 'ValidationError') {
            const errors = {};
            for (let field in error.errors) {
                errors[field] = error.errors[field].message;
            }
            // Devolvemos un objeto JSON con todos los errores
            return res.status(400).json({ errors });
        }

        if (error.code === 11000) {
            if (error.keyPattern.username) {
                return res.status(409).json({ errors: { username: 'Este nombre de usuario ya existe.' }});
            }
            if (error.keyPattern.email) {
                return res.status(409).json({ errors: { email: 'Este email ya está registrado.' }});
            }
            if (error.keyPattern.recoveryPIN) {
                return res.status(500).json({ message: 'Error al generar datos únicos. Inténtalo de nuevo.' });
            }
        }

        console.error(error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});

// Route to logout a user
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'No se pudo cerrar la sesión.' });
        }
        res.clearCookie('connect.sid'); // Limpia la cookie de sesión
        res.status(200).json({ message: 'Sesión cerrada con éxito.' });
    });
});

// Route to acces a user's profile
app.get('/api/profile', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'No autenticado. Por favor, inicie sesión.' });
    }

    try {
        const user = await User.findById(req.session.userId)
            .select('firstName lastName username email description profilePicturePath role createdAt');

        if (!user) {
            req.session.destroy(); // Limpiar sesión si el usuario ya no existe
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        res.status(200).json(user);

    }
    catch (error) {
        console.error('Error al obtener el perfil del usuario:', error);
        res.status(500).json({ message: 'Error en el servidor.' });
    }
});


// =================================================================
//  CATCH-ALL AND START SERVER
// =================================================================

// Catch-all route
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// Start the server
app.listen(PORT, () => { console.log(`Server started on 🌐 ​http://localhost:${PORT} 🌐​`); });