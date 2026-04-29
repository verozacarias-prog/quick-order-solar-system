# Sistema de Pedidos TEDLE

Sistema de pedidos por volumen para productos de energía solar. Permite a los clientes armar su pedido desde un catálogo, seleccionar forma de pago, y enviarlo por WhatsApp.

---

## Estructura de archivos

```
PedidosTedle/
├── index.html          # Estructura HTML y estilos CSS
├── pedidos_tedle.js    # Toda la lógica de la aplicación
└── productos.json      # Catálogo de productos y fecha de actualización
```

---

## Cómo funciona

### Catálogo
- Al cargar la página se hace un `fetch('productos.json')` y los datos se cargan en memoria.
- El catálogo está oculto hasta que el usuario filtra por búsqueda o categoría.
- Los productos con disponibilidad distinta de `"Disponible"` no se pueden agregar al carrito.
- Paginación de 25 productos por página.

### Descuento por volumen
El descuento se aplica sobre el total con IVA usando interpolación lineal entre los siguientes puntos:

| Total (USD c/IVA) | Descuento |
|---|---|
| $0 – $1.999 | 0% |
| $2.000 | 2% |
| $4.000 | 4,22% |
| $6.500 | 7% |
| $10.000 | 8,11% |
| $13.000 | 9,05% |
| $16.000+ | 10% |

### Formas de pago
Se pueden combinar métodos (excepto USD, que es exclusivo). Los porcentajes deben sumar 100%.

| Método | Deducción base | Por día |
|---|---|---|
| Transferencia ARS | 0% | — |
| e-check propio | 0,70% | + 0,08%/día |
| Cheque físico propio | 1,40% | + 0,08%/día |
| e-check de terceros | 1,90% | + 0,08%/día |
| Transferencia USD | — | +1% bonus sobre descuento |

Los métodos de cheque permiten múltiples instancias (ej: dos e-checks de terceros con distintos días). La deducción final se calcula de forma ponderada:

```
deducción_total = Σ (pct_i / 100 × deducción_i)
```

Si la deducción supera el descuento por volumen, la diferencia se traslada al cliente como costo financiero.

### Carrito y pedido
- El resumen muestra subtotal s/IVA, IVA, descuento por volumen, deducción por pago y total final.
- El botón de WhatsApp se habilita solo cuando los porcentajes de pago suman 100%.
- El mensaje de WhatsApp incluye datos del cliente, detalle de productos, forma de pago (con días si aplica) y resumen financiero completo.

---

## Actualizar precios y catálogo

Editar `productos.json` directamente. La estructura es:

```json
{
  "fecha_actualizacion": "28 de abril de 2026",
  "productos": [
    {
      "id": 1,
      "model": "CÓDIGO-MODELO",
      "desc": "Descripción completa del producto",
      "price": 111.00,
      "iva": 0.105,
      "avail": "Disponible",
      "cat": "NOMBRE CATEGORÍA"
    }
  ]
}
```

**Campos:**
- `price`: precio en USD sin IVA. `null` si no tiene precio publicado (muestra "Consultar").
- `iva`: tasa de IVA como decimal (`0.21` = 21%, `0.105` = 10,5%).
- `avail`: `"Disponible"` permite agregar al carrito. Cualquier otro valor lo bloquea.
- `fecha_actualizacion`: texto libre que se muestra al pie del catálogo.

Después de editar el JSON, subir el archivo al servidor. Los usuarios que recarguen la página verán los cambios inmediatamente.

---

## Hosting

La app requiere ser servida desde un servidor web (el `fetch()` no funciona abriendo el HTML con doble clic desde el disco).

**Opciones recomendadas:**
- **GitHub Pages** — gratis, sube el repo y activa Pages en la rama `main`.
- **Netlify** — gratis, conecta el repo o arrastrá la carpeta al dashboard.

**Para desarrollo local:**
```bash
# Con Ruby (viene en macOS)
ruby -run -e httpd . -p 3456

# Con Python
python3 -m http.server 3456
```

Abrir en `http://localhost:3456`.

---

## Próximos pasos

### Fuente de datos
- [ ] **Conectar Google Sheets como fuente de productos** — reemplazar el `fetch('productos.json')` por una llamada a la API de Google Sheets (vía Apps Script o la Sheets API). El JSON actual puede usarse como backup/fallback.

### Funcionalidades
- [ ] Mostrar precio en ARS además de USD (con tipo de cambio configurable en el JSON o en el header del HTML).
- [ ] Historial de pedidos (requiere backend o Google Sheets como base).
- [ ] Confirmación de pedido por email además de WhatsApp.
- [ ] Posibilidad de adjuntar nota o archivo al pedido (ej: plano de instalación).

### UX / Visual
- [ ] Modo oscuro.
- [ ] Imagen de producto en el catálogo (campo `img` en el JSON).
- [ ] Búsqueda por rango de precio.
