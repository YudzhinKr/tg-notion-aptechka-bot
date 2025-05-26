const handleReplenishMedicine = async (bot, receivedObject, userState, notion, mainKeyboard) => {
    let chatId;
    let data;
    let text;

    // Визначаємо chatId залежно від типу об'єкта
    if (receivedObject.data && receivedObject.message) {
        chatId = receivedObject.message.chat.id;
        data = receivedObject.data;
    } else if (receivedObject.chat && receivedObject.text) {
        chatId = receivedObject.chat.id;
        text = receivedObject.text;
    } else {
        console.error('🚨 Помилка: Отримано невідомий об’єкт у handleReplenishMedicine:', receivedObject);
        return;
    }

    if (text === '🔄 Поповнити аптечку') {
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
                                        callback_data: `replenish_${medicine.id}`
                                    }
                                ];
                            }
                            return null;
                        })
                        .filter(row => row !== null)
                };

                if (medicinesKeyboard.inline_keyboard.length > 0) {
                    return bot.sendMessage(chatId, '💊 Обери препарат, кількість якого ви хочете поповнити:', { reply_markup: medicinesKeyboard });
                } else {
                    return bot.sendMessage(chatId, '💊 В аптечці немає жодних ліків для поповнення.', mainKeyboard);
                }

            } else {
                return bot.sendMessage(chatId, '💊 В аптечці немає жодних ліків.', mainKeyboard);
            }
        } catch (error) {
            console.error('🚨 Помилка при отриманні списку ліків з Notion:', error.message);
            return bot.sendMessage(chatId, `❌ Сталася помилка при отриманні списку ліків: ${error.message}`, mainKeyboard);
        }
        return;
    }

    if (data && data.startsWith('replenish_')) {
        const medicineId = data.split('_')[1];
        userState[chatId] = { step: 'введення_дати_поповнення', medicineId };
        bot.answerCallbackQuery(receivedObject.id);
        const options = {
            reply_markup: {
                remove_keyboard: true,
            },
        };
        return bot.sendMessage(chatId, '📆 Введи дату придатності (у форматі DD-MM-YYYY):', options);
    }

    if (userState[chatId]?.step === 'введення_дати_поповнення' && text) {
        const cleaned = text.replace(/[./\\]/g, '-');
        const [day, month, year] = cleaned.split('-');
        if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) {
            return bot.sendMessage(chatId, '❌ Невірний формат дати. Введи у форматі *DD-MM-YYYY*, наприклад: 12-07-2025', { parse_mode: 'Markdown' });
        }
        const isoDate = `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        userState[chatId].expiryDate = isoDate;
        userState[chatId].step = 'введення_кількості_поповнення';
        return bot.sendMessage(chatId, '🔢 Введи кількість для поповнення:');
    }

    if (userState[chatId]?.step === 'введення_кількості_поповнення' && text) {
        const quantityToAdd = parseInt(text);
        if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
            return bot.sendMessage(chatId, '❌ Будь ласка, введіть коректну кількість для поповнення.');
        }
        const medicineId = userState[chatId].medicineId;
        const expiryDate = userState[chatId].expiryDate;

        try {
            const medicine = await notion.pages.retrieve({ page_id: medicineId });
            if (medicine && medicine.properties) {
                const currentQuantity = medicine.properties['Кількість']?.number || 0;
                const newQuantity = currentQuantity + quantityToAdd;

                const propertiesToUpdate = {
                    'Кількість': { number: newQuantity }
                };

                // Оновлюємо дату придатності, якщо така властивість існує
                if (medicine.properties['Дата придатності'] !== undefined) {
                    propertiesToUpdate['Дата придатності'] = { date: { start: expiryDate } };
                } else {
                    console.warn(`⚠️ Властивість 'Дата придатності' не знайдена для ліків з ID ${medicineId}.`);
                }

                await notion.pages.update({
                    page_id: medicineId,
                    properties: propertiesToUpdate
                });

                delete userState[chatId];
                return bot.sendMessage(chatId, `✅ Кількість препарату поповнено на ${quantityToAdd} шт. Нова кількість: ${newQuantity} шт.`, mainKeyboard);

            } else {
                return bot.sendMessage(chatId, '💊 Інформацію про обраний препарат не знайдено.', mainKeyboard);
            }
        } catch (error) {
            console.error('🚨 Помилка при оновленні кількості ліків у Notion:', error.message);
            return bot.sendMessage(chatId, `❌ Сталася помилка при поповненні ліків: ${error.message}`, mainKeyboard);
        }
    }
};

module.exports = handleReplenishMedicine;