// handlers/checkInventory.js
const moment = require('moment');

const checkInventoryHandler = async (bot, receivedObject, userState, notion, mainKeyboard) => {
    const chatId = receivedObject.chat ? receivedObject.chat.id : receivedObject.message.chat.id;

    try {
        const response = await notion.databases.query({
            database_id: process.env.NOTION_DATABASE_ID,
        });

        const expiringSoonThreshold = 2;
        const outOfStock = [];
        const expiringSoon = [];
        const expired = [];
        const allMedicines = [];

        response.results.forEach(page => {
            const name = page.properties['Назва препарату']?.title?.[0]?.plain_text || 'Без назви';
            const quantity = page.properties['Кількість']?.number ?? 0;
            const type = page.properties['Тип']?.select?.name;
            const expiryDateProp = page.properties['Дата придатності']?.date?.start;
            const expiryDate = expiryDateProp ? moment(expiryDateProp, 'YYYY-MM-DD') : null;
            const now = moment();
            const oneMonthFromNow = moment().add(1, 'month').startOf('day');

            allMedicines.push(`💊 ${name} - Кількість: ${quantity}`);

            if (quantity === 0) {
                outOfStock.push(`🔴 ${name}`);
            }

            // Перевірка для таблеток, порошків, ін'єкцій (кількість <= 2)
            if (type && ['Таблетки', 'Пігулки', 'Порошок', 'Ін\'єкція'].includes(type) && quantity <= expiringSoonThreshold && quantity > 0) {
                expiringSoon.push(`🟡 ${name} (залишилось ${quantity})`);
            }
                    
            console.log(`Препарат: ${name}, Дата придатності (Notion): ${expiryDateProp}, Дата придатності (Moment): ${expiryDate ? expiryDate.format('YYYY-MM-DD') : 'немає'}, Поточна дата: ${now.format('YYYY-MM-DD')}`);
            if (expiryDate && expiryDate.isValid() && expiryDate.isBefore(now, 'day')) {
                expired.push(`❌ ${name} (закінчився ${expiryDate.format('DD.MM.YYYY')})`);
            }

            else if (expiryDate && expiryDate.isValid() && expiryDate.isBefore(oneMonthFromNow, 'day') && expiryDate.isAfter(now, 'day')) {
                expiringSoon.push(`⚠️ ${name} (закінчується до ${expiryDate.format('DD.MM.YYYY')})`);
            }
        });

        let message = '✅ *Перевірка аптечки:*\n\n';

        if (expired.length > 0) {
            message += '*Прострочені препарати:*\n';
            message += expired.join('\n') + '\n\n';
        }

        if (outOfStock.length > 0) {
            message += '*Закінчились:*\n';
            message += outOfStock.join('\n') + '\n\n';
        }

        if (expiringSoon.length > 0) {
            message += `*Закінчуються:*\n`; // Змінено опис, щоб бути більш загальним
            message += expiringSoon.join('\n') + '\n\n';
        }

        if (expired.length === 0 && outOfStock.length === 0 && expiringSoon.length === 0) {
            message += '*Все в порядку, прострочених або майже закінчених препаратів не знайдено.*\n\n'; // Оновлено повідомлення
        }

       
        return bot.sendMessage(chatId, message, { parse_mode: 'Markdown', reply_markup: mainKeyboard });

    } catch (error) {
        console.error('🚨 Помилка при перевірці аптечки:', error.message);
        return bot.sendMessage(chatId, '❌ Сталася помилка при перевірці аптечки.', mainKeyboard);
    }
};

module.exports = checkInventoryHandler;