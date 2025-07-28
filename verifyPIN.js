// Se importa la librería bcrypt, indispensable para la comparación de hashes.
const bcrypt = require('bcryptjs');

/**
 * @param {string} submittedPIN
 * @param {string} storedHashedPIN
 * @returns {Promise<boolean>}
 */
async function verifyPIN(submittedPIN, storedHashedPIN) {
  try {
    const isMatch = await bcrypt.compare(submittedPIN, storedHashedPIN);
    return isMatch;
  } 
  catch (error) {
    console.error("Error al verificar el PIN:", error);
    return false;
  }
}


(async () => {
    /* --- Datos de Prueba --- */
    const HASH_ALMACENADO = ""; 
    const PIN_INTRODUCIDO = "";

    console.log(`Verificando si el PIN "${PIN_INTRODUCIDO}" corresponde al hash...`);
    const esValido = await verifyPIN(PIN_INTRODUCIDO, HASH_ALMACENADO);

    if (esValido) {
    console.log("✅ Resultado: CORRECTO");
    } else {
    console.log("❌ Resultado: FALSO");
    }
})();