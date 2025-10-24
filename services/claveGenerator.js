const crypto = require('crypto');

class ClaveGenerator {
  generateClave(sucursal, terminal, tipoDocumento, numeroConsecutivo) {
    const pais = '506'; // Costa Rica
    const dia = new Date().getDate().toString().padStart(2, '0');
    const mes = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const year = new Date().getFullYear().toString().substr(-2);
    
    const situacion = '1'; // Normal
    
    // Construir clave sin dígito verificador
    const claveBase = 
      pais + 
      dia + mes + year + 
      sucursal.padStart(3, '0') + 
      terminal.padStart(5, '0') + 
      tipoDocumento + 
      numeroConsecutivo.padStart(10, '0') + 
      situacion;
    
    // Calcular dígito verificador
    const digitoVerificador = this.calculateVerificationDigit(claveBase);
    
    return claveBase + digitoVerificador;
  }

  calculateVerificationDigit(clave) {
    // Algoritmo específico para Costa Rica
    const digits = clave.split('').map(Number);
    let sum = 0;
    
    for (let i = 0; i < digits.length; i++) {
      const multiplier = (i % 6) + 2;
      sum += digits[i] * multiplier;
    }
    
    const remainder = sum % 11;
    return remainder < 2 ? remainder : 11 - remainder;
  }
}
module.exports = ClaveGenerator;