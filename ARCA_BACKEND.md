# Backend ARCA

Este backend emite Factura B desde Firebase Functions usando el certificado de ARCA.

## Datos configurados

- CUIT emisor: `27148478053`
- Punto de venta: `7`
- Tipo: Factura B
- Receptor: Consumidor Final
- IVA: 10,5%
- Concepto general: productos

## Archivos sensibles

Estos archivos quedan en la PC y no se suben al repo:

- `C:\ARCA\arca.key`
- `C:\ARCA\certificado.crt`

## Secretos de Firebase

Ya se cargaron estos secretos:

```powershell
firebase functions:secrets:set ARCA_KEY --data-file "C:\ARCA\arca.key"
firebase functions:secrets:set ARCA_CERT --data-file "C:\ARCA\certificado.crt"
firebase functions:secrets:set ARCA_INVOICE_TOKEN
```

## Despliegue

La Function desplegada es:

```text
https://us-central1-panaderia-venta.cloudfunctions.net/facturarVenta
```

En esta PC `npm install` se trabo dentro de la carpeta `Documents\Codex`, pero funciono desde una carpeta temporal de Windows. Si vuelve a pasar, desplegar desde una carpeta temporal con las dependencias instaladas.

## Uso

En `Cuaderno`, cada venta normal muestra el boton `Facturar`. La Function busca la venta en Firebase por `saleId`, usa el total guardado en la base y evita facturar dos veces si la venta ya tiene CAE.

Al facturar correctamente, la venta guarda:

- CAE
- vencimiento de CAE
- punto de venta
- numero de comprobante
