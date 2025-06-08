const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '../users.json');

const getUsers = () => {
    if (!fs.existsSync(USERS_FILE)) return [];
    const data = fs.readFileSync(USERS_FILE);
    return JSON.parse(data);
};

const addUser = (chatId) => {
    const users = getUsers();
    if (!users.includes(chatId)) {
        users.push(chatId);
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log(`✅ Додано нового користувача: ${chatId}`);
    }
};

module.exports = { getUsers, addUser };
