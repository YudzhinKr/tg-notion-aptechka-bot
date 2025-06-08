require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const notion = require('./notion');
const addMedicineHandler = require('./handlers/addMedicine');
const useMedicineHandler = require('./handlers/useMedicine');
const replenishMedicineHandler = require('./handlers/replenishMedicine');
const deleteMedicineHandler = require('./handlers/deleteMedicine');
const checkInventoryHandler = require('./handlers/checkInventory');
const searchMedicineHandler = require('./handlers/searchMedicine');
const { startScheduler } = require('./scheduler');
const { addUser } = require('./handlers/userManager'); // ⬅️ Додано

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
    addUser(chatId); // ⬅️ Додано
    userState[chatId] = { step: 'очікування_дії' };
    bot.sendMessage(chatId, '💊 Що ви хочете зробити?', mainKeyboard);
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    console.log('Отримано повідомлення:', text);

    if (text === '➕ Додати ліки') {
        addMedicineHandler(bot, msg, userState, notion, mainKeyboard);
        return;
    }

    if (text === '➖ Використати ліки') {
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
        deleteMedicineHandler(bot, msg, userState, notion, mainKeyboard);
        return;
    }

    if (text === '✅ Перевірити аптечку') {
        checkInventoryHandler(bot, msg, userState, notion, mainKeyboard);
        return;
    }

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
            case 'підтвердження_видалення':
                deleteMedicineHandler(bot, msg, userState, notion, mainKeyboard);
                break;
            default:
                break;
        }
    }
});

bot.on('callback_query', async (callbackQuery) => {
    if (callbackQuery.data?.startsWith('use_')) {
        useMedicineHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }
    if (callbackQuery.data?.startsWith('replenish_')) {
        replenishMedicineHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }
    if (callbackQuery.data?.startsWith('delete_')) {
        deleteMedicineHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }
    if (callbackQuery.data?.startsWith('search_medicine') || callbackQuery.data === 'search_by_category' || callbackQuery.data.startsWith('category_')) {
        await searchMedicineHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }
    if (callbackQuery.data === 'check_inventory') {
        checkInventoryHandler(bot, callbackQuery, userState, notion, mainKeyboard);
    }
});

// ⬇️ Запускаємо планувальник
startScheduler(bot);

const app = express();
app.get("/", (req, res) => res.send("🤖 Telegram bot is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 HTTP сервер працює на порту ${PORT}`);
});
