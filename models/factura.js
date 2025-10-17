
// Nuevo objeto solicitado (ejemplo base como deberia verse la factura completa)
const document = {
  documentName: 'FacturaElectronica',
  providerId: 'PROVIDER_ID',
  countryCode: '506',
  securityCode: '12345678',
  activityCode: '930903',
  consecutiveIdentifier: '1',
  ceSituation: '1',
  branch: '1',
  terminal: '1',
  emitter: {
    fullName: 'EMPRESA S.A',
    identifier: { type: '01', id: '206920142' },
    activityCode: '930903',
    location: { province: '2', canton: '06', district: '04', neighborhood: '00006', details: 'Dirección' }
  },
  receiver: {
    fullName: 'CLIENTE',
    identifier: { type: '02', id: '3101538252' },
    activityCode: '930903',
    location: { province: '2', canton: '01', district: '08', neighborhood: '00001', details: 'Dirección cliente' }
  },
  orderLines: [
    {
      detail: 'Producto X',
      unitaryPrice: 100,
      quantity: 1,
      tax: { code: '01', rateCode: '08', rate: 13 }
    }
  ],
  conditionSale: '01',
  paymentMethod: '01'
};
module.exports = {
  document
};
// Modelo de Factura para validación y referencia de estructura
// const FacturaModel = {
//   emitter: {
//     fullName: '',
//     commercialName: '',
//     activityCode: '',
//     identifier: {
//       type: '',
//       id: ''
//     },
//     location: {
//       province: '',
//       canton: '',
//       district: '',
//       neighborhood: '',
//       details: ''
//     },
//     email: '',
//     fax: {
//       countryCode: '',
//       number: ''
//     },
//     phone: {
//       countryCode: '',
//       number: ''
//     }
//   },
//   branch: '',
//   terminal: '',
//   documentName: '',
//   providerId: '',
//   countryCode: '',
//   securityCode: '',
//   activityCode: '',
//   consecutiveIdentifier: '',
//   ceSituation: '',
//   orderLines: [
//     {
//       detail: '',
//       unitaryPrice: 0,
//       lineNumber: '',
//       code: '',
//       quantity: 0,
//       measureUnit: '',
//       totalAmount: 0,
//       subTotal: 0,
//       tax: {
//         code: '',
//         rateCode: '',
//         rate: 0,
//         amount: 0
//       },
//       totalOrderLineAmount: 0
//     }
//   ],
//   referenceInfo: {},
//   conditionSale: '',
//   paymentMethod: '',
//   currencyCode: '',
//   exchangeRate: '',
//   receiver: {
//     fullName: '',
//     commercialName: '',
//     activityCode: '',
//     identifier: {
//       type: '',
//       id: ''
//     },
//     location: {
//       province: '',
//       canton: '',
//       district: '',
//       neighborhood: '',
//       details: ''
//     },
//     email: '',
//     fax: {
//       countryCode: '',
//       number: ''
//     },
//     phone: {
//       countryCode: '',
//       number: ''
//     }
//   }
// };

// module.exports = FacturaModel;

// const FacturaModel = {
//   Clave: '',
//   CodigoActividad: '',
//   NumeroConsecutivo: '',
//   FechaEmision: '',
//   Emisor: {
//     Nombre: '',
//     Identificacion: {
//       Tipo: '',
//       Numero: ''
//     },
//     Ubicacion: {
//       Provincia: '',
//       Canton: '',
//       Distrito: '',
//       OtrasSenas: ''
//     },
//     CorreoElectronico: '',
//     Telefono: {
//       CodigoPais: '',
//       NumTelefono: ''
//     }
//   },
//   Receptor: {
//     Nombre: '',
//     Identificacion: {
//       Tipo: '',
//       Numero: ''
//     },
//     CorreoElectronico: ''
//   },
//   CondicionVenta: '',
//   MedioPago: [],
//   DetalleServicio: {
//     LineaDetalle: [
//       {
//         NumeroLinea: 0,
//         Cantidad: '',
//         UnidadMedida: '',
//         Detalle: '',
//         Codigo: '',
//         PrecioUnitario: '',
//         MontoTotal: '',
//         SubTotal: '',
//         BaseImponible: '',
//         Impuesto: [
//           {
//             Codigo: '',
//             Tarifa: '',
//             Monto: ''
//           }
//         ],
//         MontoTotalLinea: ''
//       }
//     ]
//   },
//   ResumenFactura: {
//     CodigoMoneda: '',
//     TotalServGravados: '',
//     TotalServExentos: '',
//     TotalMercanciasGravadas: '',
//     TotalMercanciasExentas: '',
//     TotalGravado: '',
//     TotalExento: '',
//     TotalVenta: '',
//     TotalDescuentos: '',
//     TotalVentaNeta: '',
//     TotalImpuesto: '',
//     TotalComprobante: ''
//   }
// };

// module.exports = FacturaModel;