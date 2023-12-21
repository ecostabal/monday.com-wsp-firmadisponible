const axios = require('axios');

// Reemplaza con tu API key de Monday.com y WhatsApp
const mondayApiKey = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjIzMjg3MzUyNCwiYWFpIjoxMSwidWlkIjoyMzUzNzM2NCwiaWFkIjoiMjAyMy0wMS0zMVQyMTowMjoxNy4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6OTUwNzUxNiwicmduIjoidXNlMSJ9.lX1RYu90B2JcH0QxITaF8ymd4d6dBes0FJHPI1mzSRE';
const whatsappApiKey = 'TALv6nvaUcaYxJxL2wnTjKWZAK';

// Función para obtener datos de un item de Monday.com
async function getMondayItemData(itemId) {
    const query = `
        query {
            items(ids: [${itemId}]) {
                column_values {
                    id
                    text
                    value
                }
                subitems {
                    column_values {
                        id
                        text
                        value
                    }
                }
            }
        }
    `;

    const response = await axios.post('https://api.monday.com/v2', { query }, {
        headers: {
            'Authorization': `Bearer ${mondayApiKey}`,
            'Content-Type': 'application/json'
        }
    });

    const itemData = response.data?.data?.items[0];

    // Verificar el tipo de contrato
    const contractType = itemData.column_values.find(cv => cv.id === 'estado_1')?.text;
    if (contractType !== 'Arriendo') {
        console.log('El tipo de contrato no es Arriendo. Función no ejecutada.');
        return null;
    }

    return itemData;
}

// Función para enviar mensaje de WhatsApp
async function sendWhatsAppMessage(to, name, address) {
    if (!to.startsWith('+')) {
        to = '+' + to;
    }

    const apiUrl = 'https://waba-v2.360dialog.io/messages';

    const data = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "template",
        "template": {
            "name": 'firma_disponible',
            "language": {
                "code": 'es'
            },
            "components": [
                {
                    "type": "body",
                    "parameters": [
                        { "type": "text", "text": name },
                        { "type": "text", "text": address }
                    ]
                }
            ]
        }
    };

    try {
        const response = await axios.post(apiUrl, data, { headers: { 'D360-API-KEY': whatsappApiKey } });
        console.log('Mensaje enviado a', to, 'Respuesta:', response.data);
    } catch (error) {
        console.error('Error al enviar mensaje a', to, 'Error:', error);
    }
}

// Función principal para procesar subelementos y enviar mensajes de WhatsApp
async function processSubElementsAndSendMessages(itemId) {
    try {
        const itemData = await getMondayItemData(itemId);

        if (!itemData) {
            console.error('No se encontraron datos para el item ID:', itemId);
            return;
        }

        console.log('Datos del item:', itemData);

        const address = itemData.column_values.find(cv => cv.id === 'ubicaci_n')?.text;
        console.log('Dirección:', address);

        for (const subitem of itemData.subitems) {
            console.log('Procesando subitem:', subitem);

            const nameColumn = subitem.column_values.find(cv => cv.id === 'reflejo0');
            const phoneColumn = subitem.column_values.find(cv => cv.id === 'reflejo_2');

            if (nameColumn?.text && phoneColumn?.text) {
                console.log('Enviando mensaje a:', nameColumn.text, 'Teléfono:', phoneColumn.text);
                await sendWhatsAppMessage(phoneColumn.text, nameColumn.text, address);
            }
        }

    } catch (error) {
        console.error('Error al procesar subelementos:', error);
    }
}

exports.wspFirmaDisponible = async (req, res) => {
    const itemId = req.body.event.pulseId;
    console.log('Webhook activado para item ID:', itemId);
    await processSubElementsAndSendMessages(itemId);
    res.status(200).send('Mensajes enviados');
};