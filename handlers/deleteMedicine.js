const handleDeleteMedicine = async (bot, receivedObject, userState, notion, mainKeyboard) => {
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
        console.error('🚨 Помилка: Отримано невідомий об’єкт у handleDeleteMedicine:', receivedObject);
        return;
    }

    if (text === '🗑️ Видалити препарат') {
        try {
            // Відправляємо повідомлення з прихованням клавіатури
            await bot.sendMessage(chatId, 'Виберіть препарат для видалення...', { reply_markup: { remove_keyboard: true } });

            const response = await notion.databases.query({
                database_id: process.env.NOTION_DATABASE_ID,
            });

            if (response.results && response.results.length > 0) {
                const medicinesKeyboard = {
                    inline_keyboard: response.results
                        .map(medicine => {
                            const titleProperty = medicine.properties['Назва препарату'];
                            const expiryDateProperty = medicine.properties['Дата придатності'];
                            if (titleProperty && titleProperty.title && titleProperty.title.length > 0) {
                                const medicineName = titleProperty.title[0].plain_text;
                                const expiryDate = expiryDateProperty?.date?.start ? ` (${expiryDateProperty.date.start.split('-').reverse().join('-')})` : ' (термін придатності не вказано)';
                                return [
                                    {
                                        text: `${medicineName}${expiryDate}`,
                                        callback_data: `delete_confirm_${medicine.id}`
                                    }
                                ];
                            }
                            return null;
                        })
                        .filter(row => row !== null)
                };

                if (medicinesKeyboard.inline_keyboard.length > 0) {
                    return bot.sendMessage(chatId, '🗑️ Обери препарат, який ви хочете видалити:', { reply_markup: medicinesKeyboard });
                } else {
                    return bot.sendMessage(chatId, '💊 В аптечці немає жодних ліків для видалення.', mainKeyboard);
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

    if (data && data.startsWith('delete_confirm_')) {
        const medicineId = data.split('_')[2]; // Отримуємо ID препарату
        try {
            const medicine = await notion.pages.retrieve({ page_id: medicineId });
            if (medicine && medicine.properties) {
                const medicineName = medicine.properties['Назва препарату'].title[0].plain_text;
                const expiryDateProperty = medicine.properties['Дата придатності'];
                const expiryDateFormatted = expiryDateProperty?.date?.start ? `(${expiryDateProperty.date.start.split('-').reverse().join('-')})` : 'не вказана';

                userState[chatId] = { step: 'підтвердження_видалення', medicineId };
                const confirmationKeyboard = {
                    inline_keyboard: [
                        [
                            { text: 'Так', callback_data: `delete_yes_${medicineId}` },
                            { text: 'Ні', callback_data: 'delete_no' }
                        ]
                    ]
                };
                
                return bot.sendMessage(chatId, `⚠️ Ви точно хочете видалити препарат *${medicineName}* ${expiryDateFormatted}?`, {
                    parse_mode: 'Markdown',
                    reply_markup: confirmationKeyboard
                });
                 
                return bot.sendMessage(chatId, '💊 Інформацію про обраний препарат не знайдено.', mainKeyboard);
            }
        } catch (error) {
            console.error('🚨 Помилка при отриманні інформації про ліки з Notion:', error.message);
            return bot.sendMessage(chatId, `❌ Сталася помилка при отриманні інформації про ліки: ${error.message}`, mainKeyboard);
        }
        return;
    }

    if (data && data.startsWith('delete_yes_')) {
        const medicineId = data.split('_')[2];
        try {
            await notion.pages.update({
                page_id: medicineId,
                archived: true,
            });
            bot.answerCallbackQuery(receivedObject.id);
            return bot.sendMessage(chatId, `✅ Препарат успішно видалено з аптечки.`, mainKeyboard);
        } catch (error) {
            console.error('🚨 Помилка при видаленні ліків з Notion:', error.message);
            return bot.sendMessage(chatId, `❌ Сталася помилка при видаленні препарату: ${error.message}`, mainKeyboard);
        }
        return;
    }

    if (data === 'delete_no') {
        bot.answerCallbackQuery(receivedObject.id);
        return bot.sendMessage(chatId, '✅ Видалення скасовано.', mainKeyboard);
    }
};

module.exports = handleDeleteMedicine;