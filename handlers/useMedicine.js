const handleUseMedicine = async (bot, receivedObject, userState, notion, mainKeyboard) => {
    
    let chatId;
    let data;
    let text;

    // Якщо це callback_query
    if (receivedObject.data && receivedObject.message) {
        chatId = receivedObject.message.chat.id;
        data = receivedObject.data;
    }
    // Якщо це звичайне повідомлення
    else if (receivedObject.chat && receivedObject.text) {
        chatId = receivedObject.chat.id;
        text = receivedObject.text;
    }
    else {
        console.error('🚨 Помилка: Отримано невідомий об’єкт у handleUseMedicine:', receivedObject);
        return;
    }

    // Далі твоя існуюча логіка...


    
    if (text === '➖ Використати ліки') {
        try {
            const response = await notion.databases.query({
                database_id: process.env.NOTION_DATABASE_ID,
            });

            if (response.results && response.results.length > 0) {
                const medicinesKeyboard = {
                    inline_keyboard: response.results
                        .map(medicine => {
                            const titleProperty = medicine.properties['Назва препарату'];
                            if (titleProperty && titleProperty.title && titleProperty.title.length > 0) {
                                return [
                                    {
                                        text: titleProperty.title[0].plain_text,
                                        callback_data: `use_${medicine.id}`
                                    }
                                ];
                            }
                            return null; // Пропускаємо записи без назви
                        })
                        .filter(row => row !== null) // Видаляємо пропущені записи
                };

                if (medicinesKeyboard.inline_keyboard.length > 0) {
                    return bot.sendMessage(chatId, '💊 Обери препарат, який ви хочеш використати:', { reply_markup: medicinesKeyboard });
                } else {
                    return bot.sendMessage(chatId, '💊 В аптечці немає жодних ліків для використання.', mainKeyboard);
                }

            } else {
                return bot.sendMessage(chatId, '💊 В аптечці немає жодних ліків для використання.', mainKeyboard);
            }
        } catch (error) {
            console.error('🚨 Помилка при отриманні списку ліків з Notion:', error.message);
            return bot.sendMessage(chatId, `❌ Сталася помилка при отриманні списку ліків: ${error.message}`, mainKeyboard);
        }
        return; // Важливо додати return, щоб уникнути подальшої обробки
    }

    if (data && data.startsWith('use_')) {
        const medicineId = data.split('_')[1];
        try {
            const medicine = await notion.pages.retrieve({ page_id: medicineId });
            if (medicine && medicine.properties) {
                const medicineName = medicine.properties['Назва препарату'].title[0].plain_text;
                const availableQuantity = medicine.properties['Кількість'].number || 0;

                userState[chatId] = { step: 'введення_кількості_для_використання', medicineId };
                bot.answerCallbackQuery(receivedObject.id); // Підтверджуємо callback_query
                return bot.sendMessage(chatId, `💊 Препарату *${medicineName}* зараз є у наявності: *${availableQuantity} шт*.
                     Скільки шт ви використаєте?`, { parse_mode: 'Markdown' });
            } else {
                return bot.sendMessage(chatId, '💊 Інформацію про обраний препарат не знайдено.', mainKeyboard);
            }
        } catch (error) {
            console.error('🚨 Помилка при отриманні інформації про ліки з Notion:', error.message);
            return bot.sendMessage(chatId, `❌ Сталася помилка при отриманні інформації про ліки: ${error.message}`, mainKeyboard);
        }
        return; // Важливо додати return
    }

    // Обробка введення кількості для використання
    if (userState[chatId]?.step === 'введення_кількості_для_використання' && receivedObject.text) {
        const text = receivedObject.text;
        const quantityToUse = parseInt(text);
        if (isNaN(quantityToUse) || quantityToUse <= 0) {
            return bot.sendMessage(chatId, '❌ Будь ласка, введіть коректну кількість для використання.');
        }

        const medicineId = userState[chatId].medicineId;
        try {
            const medicine = await notion.pages.retrieve({ page_id: medicineId });
            if (medicine && medicine.properties) {
                const availableQuantity = medicine.properties['Кількість'].number || 0;

                if (quantityToUse > availableQuantity) {
                    return bot.sendMessage(chatId, `❌ Недостатньо препарату *${medicine.properties['Назва препарату'].title[0].plain_text}*. В наявності лише *${availableQuantity} шт*.`, { parse_mode: 'Markdown' });
                }

                const newQuantity = availableQuantity - quantityToUse;
                await notion.pages.update({
                    page_id: medicineId,
                    properties: {
                        'Кількість': { number: newQuantity }
                    }
                });

                delete userState[chatId];
                return bot.sendMessage(chatId, `✅ Використано ${quantityToUse} шт препарату ${medicine.properties['Назва препарату'].title[0].plain_text}. 
                    Залишилося ${newQuantity} шт.`, mainKeyboard);
            } else {
                return bot.sendMessage(chatId, '💊 Інформацію про обраний препарат не знайдено.', mainKeyboard);
            }
        } catch (error) {
            console.error('🚨 Помилка при оновленні кількості ліків у Notion:', error.message);
            return bot.sendMessage(chatId, `❌ Сталася помилка при оновленні кількості ліків: ${error.message}`, mainKeyboard);
        }
    }
};



module.exports = handleUseMedicine;