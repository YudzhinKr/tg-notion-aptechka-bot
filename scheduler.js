const cron = require('node-cron');
const moment = require('moment');
const notion = require('./notion');
const { getUsers } = require('./handlers/userManager'); // ⬅️ Новий імпорт
const TelegramBot = require('node-telegram-bot-api');

let botInstance;

const setBotInstance = (bot) => {
    botInstance = bot;
};

const checkExpiryDates = async () => {
    if (!botInstance) {
        console.error('🚨 Telegram Bot instance is not set in scheduler.js');
        return;
    }

    const chatIds = getUsers();
    if (!chatIds.length) {
        console.warn('⚠️ Немає користувачів для розсилки нагадувань.');
        return;
    }

    console.log('⏰ Перевірка термінів придатності...');
    try {
        const response = await notion.databases.query({
            database_id: process.env.NOTION_DATABASE_ID,
        });

        const now = moment().startOf('day');
        const oneMonthFromNow = moment().add(1, 'month').endOf('day');

        response.results.forEach(page => {
            const name = page.properties['Назва препарату']?.title?.[0]?.plain_text;
            const expiryDateProp = page.properties['Дата придатності']?.date?.start;

            if (name && expiryDateProp) {
                const expiryDate = moment(expiryDateProp, 'YYYY-MM-DD').startOf('day');

                if (expiryDate.isSameOrBefore(oneMonthFromNow) && expiryDate.isAfter(now)) {
                    const daysRemaining = expiryDate.diff(now, 'days');

                    let message = `⚠️ Нагадування: Термін придатності препарату *${name}* закінчується *${expiryDate.format('DD.MM.YYYY')}*! Залишилось *${daysRemaining}* днів.`;

                    if (daysRemaining === 3) {
                        message = `🚨 *Термін майже вийшов!* Препарат *${name}* закінчується через *3 дні* — *${expiryDate.format('DD.MM.YYYY')}*!`;
                    }

                    botInstance.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
                }
            }
        });
        console.log('✅ Перевірку термінів придатності завершено.');
    } catch (error) {
        console.error('🚨 Помилка під час перевірки термінів придатності:', error);
    }
};

const startScheduler = (bot) => {
    setBotInstance(bot);
    cron.schedule('0 9 * * *', checkExpiryDates, {
        timezone: "Europe/Kiev"
    });
    console.log('📅 Планувальник запущено (10, 20 та 30 числа кожного місяя о 9:00 за Києвом).');

    checkExpiryDates(); // Запуск при старті
};

module.exports = { startScheduler };
