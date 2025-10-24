const forge = require('node-forge');
const fs = require('fs');

class XMLSigner {
  constructor(certificatePath, privateKeyPath, password) {
    this.certificate = this.loadCertificate(certificatePath);
    this.privateKey = this.loadPrivateKey(privateKeyPath, password);
  }

  signXML(xmlString) {
    try {
      // Crear el objeto de firma
      const signature = forge.xmldsig.createSignature();
      
      // Configurar la firma
      signature.algorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
      signature.keyInfo = forge.xmldsig.createKeyInfo();
      signature.keyInfo.addX509Data(this.certificate);
      
      // Firmar el XML
      const signedXml = forge.xmldsig.sign(xmlString, this.privateKey, signature);
      
      return signedXml;
    } catch (error) {
      throw new Error(`Error al firmar XML: ${error.message}`);
    }
  }
}