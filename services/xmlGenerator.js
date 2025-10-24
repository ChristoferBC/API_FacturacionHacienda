const { create } = require('xmlbuilder2');
class FacturaXMLGenerator {
  generateFacturaElectronica(facturaData) {
    const xml = create({
      'fe:FacturaElectronica': {
        '@xmlns:fe': 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica',
        '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'fe:Clave': facturaData.clave,
        'fe:CodigoActividad': facturaData.codigoActividad,
        'fe:NumeroConsecutivo': facturaData.numeroConsecutivo,
        'fe:FechaEmision': facturaData.fechaEmision,
        'fe:Emisor': {
          'fe:Nombre': facturaData.emisor.nombre,
          'fe:Identificacion': {
            'fe:Tipo': facturaData.emisor.tipoId,
            'fe:Numero': facturaData.emisor.numeroId
          }
        },
        'fe:Receptor': {
          'fe:Nombre': facturaData.receptor.nombre,
          'fe:Identificacion': {
            'fe:Tipo': facturaData.receptor.tipoId,
            'fe:Numero': facturaData.receptor.numeroId
          }
        },
        'fe:DetalleServicio': this.generateLineItems(facturaData.items),
        'fe:ResumenFactura': this.generateSummary(facturaData)
      }
    });
    
    return xml.end({ prettyPrint: true });
  }
}