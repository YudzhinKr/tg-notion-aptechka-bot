require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const notion = require('./notion');
const addMedicineHandler = require('./handlers/addMedicine');
const useMedicineHandler = require('./handlers/useMedicine');
const replenishMedicineHandler = require('./handlers/replenishMedicine');
const deleteMedicineHandler = require('./handlers/deleteMedicine'); // Підключаємо обробник видалення
const checkInventoryHandler = require('./handlers/checkInventory'); // Підключаємо обробник перевірки
const searchMedicineHandler = require('./handlers/searchMedicine');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const userState = {};

const mainKeyboard = {
    reply_markup: {
        keyboard: [
            ['➕ Додати ліки', '➖ Використати ліки', '🔄 Поповнити аптечку'],
            ['🔍 Пошук в аптечці', '🗑️ Видалити препарат', '✅ Перевірити аптечку']
        ],
        resize_keyboard: true
    }
};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userState[chatId] = { step: 'очікування_дії' };
    bot.sendMessage(chatId, '💊 Що ви хочете зробити?', mainKeyboard);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    console.log('Отримано повідомлення:', text); // Додайте цей рядок

    if (text === '➕ Додати ліки') {
        addMedicineHandler(bot, msg, userState, notion, mainKeyboard);
        return;
    }

    if (msg.text === '➖ Використати ліки') {
        await useMedicineHandler(bot, msg, userState, notion, mainKeyboard);
        return;
    }

    if (text === '🔄 Поповнити аптечку') {
        replenishMedicineHandler(bot, msg, userState, notion, mainKeyboard);
        return;
    }

    if (text === '🔍 Пошук в аптечці') {
        await searchMedicineHandler(bot, msg, userState, notion, mainKeyboard);
        return;
    }
    

    if (text === '🗑️ Видалити препарат') {
        deleteMedicineHandler(bot, msg, userState, notion, mainKeyboard); // Викликаємо обробник видалення
        return;
    }

    if (text === '✅ Перевірити аптечку') {
        checkInventoryHandler(bot, msg, userState, notion, mainKeyboard); // Викликаємо обробник перевірки
        return;
    }

    // Обробка введення даних залежно від поточного стану користувача
    if (userState[chatId]?.step) {
        switch (userState[chatId].step) {
            case 'назва':
            case 'відЧого':
            case 'дата':
            case 'тип':
            case 'кількість':
                addMedicineHandler(bot, msg, userState, notion, mainKeyboard);
                break;
            case 'введення_кількості_для_використання':
                useMedicineHandler(bot, msg, userState, notion, mainKeyboard);
                break;
            case 'введення_дати_поповнення':
            case 'введення_кількості_поповнення':
                replenishMedicineHandler(bot, msg, userState, notion, mainKeyboard);
                break;
            // Додамо обробку станів для видалення, якщо буде потрібно
            case 'підтвердження_видалення':
                deleteMedicineHandler(bot, msg, userState, notion, mainKeyboard);
                break;
            default:
                break;
        }
    }
});

// Обробник callback_query
bot.on('callback_query', async (callbackQuery) => {
 
    if (callbackQuery.data && callbackQuery.data.startsWith('use_')) {
        useMedicineHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }
    if (callbackQuery.data && callbackQuery.data.startsWith('replenish_')) {
        replenishMedicineHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }
    // Додамо обробку callback_query для видалення та перевірки, якщо буде інлайн клавіатура
    if (callbackQuery.data && callbackQuery.data.startsWith('delete_')) {
        deleteMedicineHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }

    if (callbackQuery.data && callbackQuery.data.startsWith('search_medicine')) {
        searchMedicineHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }
    if ( callbackQuery.data === 'search_by_category') {
        searchMedicineHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }
    if (callbackQuery.data && callbackQuery.data.startsWith('category_')) {
        await searchMedicineHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }
    
    if (callbackQuery.data && callbackQuery.data === 'check_inventory') {
        checkInventoryHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }
});