// Modelo de Factura para validación y referencia de estructura
const FacturaModel = {
  emitter: {
    fullName: '',
    commercialName: '',
    activityCode: '',
    identifier: {
      type: '',
      id: ''
    },
    location: {
      province: '',
      canton: '',
      district: '',
      neighborhood: '',
      details: ''
    },
    email: '',
    fax: {
      countryCode: '',
      number: ''
    },
    phone: {
      countryCode: '',
      number: ''
    }
  },
  branch: '',
  terminal: '',
  documentName: '',
  providerId: '',
  countryCode: '',
  securityCode: '',
  activityCode: '',
  consecutiveIdentifier: '',
  ceSituation: '',
  orderLines: [
    {
      detail: '',
      unitaryPrice: 0,
      lineNumber: '',
      code: '',
      quantity: 0,
      measureUnit: '',
      totalAmount: 0,
      subTotal: 0,
      tax: {
        code: '',
        rateCode: '',
        rate: 0,
        amount: 0
      },
      totalOrderLineAmount: 0
    }
  ],
  referenceInfo: {},
  conditionSale: '',
  paymentMethod: '',
  currencyCode: '',
  exchangeRate: '',
  receiver: {
    fullName: '',
    commercialName: '',
    activityCode: '',
    identifier: {
      type: '',
      id: ''
    },
    location: {
      province: '',
      canton: '',
      district: '',
      neighborhood: '',
      details: ''
    },
    email: '',
    fax: {
      countryCode: '',
      number: ''
    },
    phone: {
      countryCode: '',
      number: ''
    }
  }
};

module.exports = FacturaModel;

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