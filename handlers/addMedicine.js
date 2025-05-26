const handleAddMedicine = async (bot, msg, userState, notion, mainKeyboard) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const state = userState[chatId];

    if (text === '➕ Додати ліки') {
        userState[chatId] = { step: 'назва' };
        const options = {
            reply_markup: {
                remove_keyboard: true,
            },
        };
        return bot.sendMessage(chatId, '🟢 Введи назву препарату:', options);
    }

    if (!state) return;

    switch (state.step) {
        case 'назва':
            state.назва = text;
            state.step = 'відЧого';
            return bot.sendMessage(chatId, '💊 Від чого цей препарат?');
        case 'відЧого':
            // Перетворюємо введений текст на нижній регістр
            state.відЧого = text.toLowerCase();
            state.step = 'дата';
            return bot.sendMessage(chatId, '📆 Введи дату придатності (у форматі DD-MM-YYYY):');
        case 'дата':
            const cleaned = text.replace(/[./\\]/g, '-');
            const [day, month, year] = cleaned.split('-');
            if (!day || !month || !year || isNaN(day) || isNaN(month) || isNaN(year)) {
                return bot.sendMessage(chatId, '❌ Невірний формат дати. Введи у форматі *DD-MM-YYYY*, наприклад: 12-07-2025', { parse_mode: 'Markdown' });
            }
            const isoDate = `${year.padStart(4, '20')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            state.дата = isoDate;
            state.step = 'тип';
            const typeKeyboard = {
                reply_markup: {
                    keyboard: [
                        ['Таблетки', 'Спрей'],
                        ['Гель/мазь', 'Сіроп'],
                        ['Ін\'єкції', 'Краплі'],
                        ['Порошок', 'Інгалятор']
                    ],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                },
            };
            return bot.sendMessage(chatId, '📦 Обери тип препарату:', typeKeyboard);
        case 'тип':
            const allowedTypes = ['таблетки', 'спрей', 'гель/мазь', 'сіроп', 'ін\'єкції', 'краплі', 'порошок' , 'інгалятор'];
            if (allowedTypes.includes(text.toLowerCase())) {
                state.тип = text;
                state.step = 'кількість';
                return bot.sendMessage(chatId, '🔢 Кількість:');
            } else {
                const typeKeyboard = {
                    reply_markup: {
                        keyboard: [
                            ['Таблетки', 'Спрей'],
                            ['Гель/мазь', 'Сіроп'],
                            ['Ін\'єкції', 'Краплі'],
                            ['Порошок', 'Інгалятор']
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: true,
                    },
                };
                return bot.sendMessage(chatId, '❌ Будь ласка, обери тип препарату з клавіатури:', typeKeyboard);
            }
        case 'кількість':
            const кількість = parseInt(text);
            if (isNaN(кількість)) {
                return bot.sendMessage(chatId, '❌ Будь ласка, введи числове значення для кількості.');
            }
            state.кількість = кількість;

            try {
                await notion.pages.create({
                    parent: { database_id: process.env.NOTION_DATABASE_ID },
                    properties: {
                        'Назва препарату': { title: [{ text: { content: state.назва } }] },
                        'Від чого': { multi_select: [{ name: state.відЧого }] },
                        'Дата придатності': { date: { start: state.дата } },
                        'Тип препарату': { select: { name: state.тип } },
                        'Кількість': { number: state.кількість }
                    }
                });

                delete userState[chatId];
                return bot.sendMessage(chatId, `✅ Препарат ${state.назва} додано до аптечки!`, mainKeyboard);
            } catch (error) {
                console.error('🚨 Помилка при додаванні до Notion:', error.message);
                return bot.sendMessage(chatId, `❌ Сталася помилка при додаванні до аптечки: ${error.message}`, mainKeyboard);
            }
            break;
    }
};

module.exports = handleAddMedicine;