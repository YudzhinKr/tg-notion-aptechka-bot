// scheduler.js
const cron = require('node-cron');
const moment = require('moment');
const notion = require('./notion'); // Переконайся, що шлях до notion.js правильний
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID; // ID чату для надсилання нагадувань
const TelegramBot = require('node-telegram-bot-api'); // Імпортуємо тут, бо потрібен для надсилання повідомлень

// Важливо: Бот повинен бути доступний тут. Передамо його з tg-bot.js
let botInstance;

const setBotInstance = (bot) => {
    botInstance = bot;
};

const checkExpiryDates = async () => {
    if (!botInstance) {
        console.error('🚨 Telegram Bot instance is not set in scheduler.js');
        return;
    }
    if (!TELEGRAM_CHAT_ID) {
        console.error('🚨 TELEGRAM_CHAT_ID is not set in .env. Please add it for expiry notifications.');
        return;
    }

    console.log('⏰ Перевірка термінів придатності...');
    try {
        const response = await notion.databases.query({
            database_id: process.env.NOTION_DATABASE_ID,
        });

        const now = moment().startOf('day');
        const oneMonthFromNow = moment().add(1, 'month').endOf('day'); // До кінця місяця

        response.results.forEach(page => {
            const name = page.properties['Назва препарату']?.title?.[0]?.plain_text;
            const expiryDateProp = page.properties['Дата придатності']?.date?.start;

            if (name && expiryDateProp) {
                const expiryDate = moment(expiryDateProp, 'YYYY-MM-DD').startOf('day');

                // Перевіряємо, чи термін придатності настає протягом наступного місяця
                // і чи він ще не настав (тобто, не прострочений)
                if (expiryDate.isSameOrBefore(oneMonthFromNow) && expiryDate.isAfter(now)) {
                    const daysRemaining = expiryDate.diff(now, 'days');
                    let message = `⚠️ Нагадування: Термін придатності препарату *${name}* закінчується *${expiryDate.format('DD.MM.YYYY')}*! Залишилось *${daysRemaining}* днів.`;
                    botInstance.sendMessage(TELEGRAM_CHAT_ID, message, { parse_mode: 'Markdown' });
                    // console.log(Надіслано нагадування про ${name});
                }
            }
        });
        console.log('✅ Перевірку термінів придатності завершено.');
    } catch (error) {
        console.error('🚨 Помилка під час перевірки термінів придатності:', error);
    }
};

// Запланувати перевірку щодня о 9:00 ранку
const startScheduler = (bot) => {
    setBotInstance(bot);
    cron.schedule('0 9 * * *', checkExpiryDates, {
        timezone: "Europe/Kiev" // Або ваш часовий пояс
    });
    console.log('📅 Планувальник для перевірки термінів придатності запущено (щодня о 9:00 за Київським часом).');
    
    // Запустити перевірку один раз при старті, для тестування або швидкого початку
    checkExpiryDates(); 
};

module.exports = { startScheduler };