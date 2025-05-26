const handleSearchMedicine = async (bot, receivedObject, userState, notion, mainKeyboard) => {
  
    let chatId;
    let data;
    let text;

    if (receivedObject.data && receivedObject.message) {
        chatId = receivedObject.message.chat.id;
        data = receivedObject.data;
    } else if (receivedObject.chat && receivedObject.text) {
        chatId = receivedObject.chat.id;
        text = receivedObject.text;
    } else {
        console.error('🚨 Невідомий формат receivedObject у handleSearchInPharmacy');
        return;
    }

    // Крок 1: Користувач натискає "🔍 Пошук в аптечці"
    if (text === '🔍 Пошук в аптечці') {
        try {
            const response = await notion.databases.query({
                database_id: process.env.NOTION_DATABASE_ID,
            });

            const allCategories = new Set();

            response.results.forEach(page => {
                const categoryProp = page.properties['Від чого'];
                if (categoryProp && categoryProp.multi_select) {
                    categoryProp.multi_select.forEach(cat => {
                        allCategories.add(cat.name);
                    });
                }
            });

            if (allCategories.size === 0) {
                return bot.sendMessage(chatId, '❌ Категорії в аптечці не знайдені.', mainKeyboard);
            }

            const categoryKeyboard = {
                inline_keyboard: [...allCategories].map(name => [{
                    text: name,
                    callback_data: `category_${name}`
                }])
            };

            return bot.sendMessage(chatId, '🔍 Обери категорію для пошуку ліків:', {
                reply_markup: categoryKeyboard
            });

        } catch (error) {
            console.error('🚨 Помилка при отриманні категорій з Notion:', error.message);
            return bot.sendMessage(chatId, '❌ Сталася помилка при завантаженні категорій.', mainKeyboard);
        }
    }

    // Крок 2: Користувач обрав категорію
    if (data && data.startsWith('category_')) {
        const selectedCategory = data.replace('category_', '');
        

        try {
           
            const response = await notion.databases.query({
                database_id: process.env.NOTION_DATABASE_ID,
                filter: {
                    property: 'Від чого',
                    multi_select: {
                        contains: selectedCategory,
                    },
                },
            });
            

            const filteredMedicines = response.results;
 

            if (filteredMedicines.length === 0) {
                return bot.sendMessage(chatId, `❌ Немає препаратів для категорії *${selectedCategory}*.`, {
                    parse_mode: 'Markdown',
                    reply_markup: mainKeyboard
                });
            }

            const messageText = filteredMedicines.map(page => {
                const nameProp = page.properties['Назва препарату'];
                const qtyProp = page.properties['Кількість'];

                const name = nameProp?.title?.[0]?.plain_text || 'Без назви';
                const qty = qtyProp?.number !== undefined ? qtyProp.number : '—';

                return `🏷️ Назва: *${name}*\n#️⃣ Кількість: *${qty} шт*`;
            }).join('\n\n');

            return bot.sendMessage(chatId, `💊 Препарати для категорії *${selectedCategory}*:\n\n${messageText}`, {
                parse_mode: 'Markdown',
                reply_markup: mainKeyboard
            });

        } catch (error) {
            console.error('🚨 Помилка при пошуку препаратів за категорією:', error.message);
            return bot.sendMessage(chatId, '❌ Сталася помилка при пошуку препаратів.', mainKeyboard);
        }
    }
};

module.exports = handleSearchMedicine;