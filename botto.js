require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.BOT_TOKEN;
const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL.replace('@', '');
const BOT_USERNAME = process.env.BOT_USERNAME;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const bot = new TelegramBot(TOKEN);


const WEBHOOK_URL = process.env.WEBHOOK_URL; // Set this in your .env file

bot.setWebHook(`${WEBHOOK_URL}/bot${TOKEN}`);



const usersFile = path.join(__dirname, 'data', 'users.json');
let users = {};
// Admin State
// Admin State
const adminState = {
    awaitingUserId: false,

    codes: {
        awaitingAmount: false,
        amount: null,
        awaitingCodesInput: false,
        awaitingViewAmount: false,
        awaitingRemoveAmount: false,
        removeAmount: null,
        awaitingRemoveCodes: false
    },

    broadcast: {
        awaitingMedia: false,
        awaitingText: false,
        awaitingButtons: false,
        media: null,
        text: '',
        buttons: []
    }
};


function resetAdminState() {
    adminState.awaitingUserId = false;

    // Reset codes
    adminState.codes.awaitingAmount = false;
    adminState.codes.amount = null;
    adminState.codes.awaitingCodesInput = false;
    adminState.codes.awaitingViewAmount = false;
    adminState.codes.awaitingRemoveAmount = false;
    adminState.codes.removeAmount = null;
    adminState.codes.awaitingRemoveCodes = false;

    // Reset broadcast
    adminState.broadcast.awaitingMedia = false;
    adminState.broadcast.awaitingText = false;
    adminState.broadcast.awaitingButtons = false;
    adminState.broadcast.media = null;
    adminState.broadcast.text = '';
    adminState.broadcast.buttons = [];
}






if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile));
}

function saveUsers() {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

async function isMember(userId) {
    try {
        const res = await bot.getChatMember(`@${REQUIRED_CHANNEL}`, userId);
        return ['member', 'administrator', 'creator'].includes(res.status);
    } catch {
        return false;
    }
}

function getReferralCount(userId) {
    return Object.values(users).filter(u => u?.referredBy?.id == userId).length;
}




function getLeaderboard(topN = 10) {
    return Object.entries(users)
        .sort(([, a], [, b]) => (b.totalStars || 0) - (a.totalStars || 0))
        .slice(0, topN)
        .map(([id, u], i) => `${i + 1}. ${u.name || 'Unknown'} (ID: ${id}) - ⭐ ${u.totalStars || 0}`)
        .join('\n') || 'No users yet.';
}




function sendAdminMenu(chatId) {
    bot.sendMessage(chatId, "🛠 *Admin Panel:*", {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [
                ['〽 All Statistics', '🔍 User Lookup'],
                ['🏆 Leaderboard', '💫 Switch as User'],
                ['🧾 View Avaailable Codes 🧾'],
                ['➕ Add Gift Codes', '🗑 Remove Codes'],
                ['📢 Broadcast Post']   // <-- New Button
            ],

            resize_keyboard: true
        }
    });
}



function sendWelcomeBackMessage(chatId, user) {
    bot.sendPhoto(chatId, path.join(__dirname, 'assets', 'new-deposit-bonus.png'), {
        caption:
            `👋 Hello: ${user.name || 'RAJA GAMES USER'}

🏛 *RAJA GAME* is a premium gaming platform offering top games like Aviator, Evolution, and Jili, with 24/7 dedicated customer support.
🏆 We prioritize trust and fairness, ensuring you a reliable gaming experience.

💸 Earn ₹50 effortlessly here! 🎉
❤️ Post & Share to Earn ₹28-288
💖 Share your unique link with friends to start earning.
📝 Click the button below to post it on social media to start earning.
💥 No limits on the number of shares—act fast and claim your rewards!

💡 Click the button below to learn more money-making tips and get the latest updates on RAJA GAME!
Website: [www.rajagames.com](https://rajagames.com)`,
        parse_mode: 'Markdown'
    }).then(() => {
        bot.sendMessage(chatId, "Welcome! Please choose an option:", {
            reply_markup: getUserMenuKeyboard(chatId)
        });
    });
}



function getUserMenuKeyboard(chatId) {
    const keyboard = [
        ['⭐ Earn Stars', '❤️ Post & Share ₹28-288'],
        ['📚 Deposit Guide', '🧩 Install Raja Game App'],
        ['💬 24-hour customer service']
    ];

    if (chatId.toString() === ADMIN_CHAT_ID) {
        keyboard.push(['💠 Admin Panel 💠']);
    }

    return {
        keyboard,
        resize_keyboard: true
    };
}







bot.onText(/\/start(?:\s*(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const referrerId = match[1];
    const username = msg.from.username || null;
    const currentDate = new Date().toISOString();

    if (!users[userId]) {
        users[userId] = {
            stars: 0,
            totalStars: 0,
            totalRedemptions: 0,
            referredBy: null,
            name: msg.from.first_name || null,
            username: username,
            joinDate: currentDate,
            lastActive: currentDate
        };

        if (referrerId && referrerId !== userId) {
            if (!users[referrerId]) {
                users[referrerId] = {
                    stars: 0,
                    totalStars: 0,
                    totalRedemptions: 0,
                    referredBy: null,
                    name: "Unknown",
                    username: null,
                    joinDate: currentDate,
                    lastActive: currentDate
                };
            }

            users[referrerId].stars += 1;
            users[referrerId].totalStars += 1;

            users[userId].referredBy = {
                id: referrerId,
                name: users[referrerId].name || "Unknown",
                username: users[referrerId].username || null
            };

            saveUsers();

            bot.sendMessage(referrerId,
                `🎉 *You earned 1 star!* Someone joined using your referral link!\n\n` +
                `⭐ *Total Stars Collected:* ${users[referrerId].totalStars}\n` +
                `🎁 *Current Balance:* ${users[referrerId].stars} ⭐`,
                { parse_mode: 'Markdown' }
            );
        }

        saveUsers();
    } else {
        users[userId].lastActive = currentDate;
        if (users[userId].username !== username) {
            users[userId].username = username;
            saveUsers();
        }
    }

    if (userId === ADMIN_CHAT_ID) {
        resetAdminState();
        sendAdminMenu(chatId);
    } else {
        sendWelcomeBackMessage(chatId, users[userId]);
    }

});




// Full Refactored bot.on('message') Block with Helpers

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const text = msg.text || '';

    if (text.startsWith('/')) return;

    if (await handleAdminBroadcastFlow(msg, chatId, userId, text)) return;
    if (await handleAdminCodeFlow(msg, chatId, userId, text)) return;
    if (await handleAdminMenuActions(chatId, userId, text)) return;
    if (await handleAdminUserLookup(chatId, userId, text)) return;

    // Membership check for normal users
    if (!(await isMember(userId)) && userId !== ADMIN_CHAT_ID) {
        const channelLink = `https://t.me/${REQUIRED_CHANNEL}`;
        return bot.sendMessage(chatId, `🚫 Please join our official channel to use this feature.\n👉 [Join Our Channel](${channelLink})`, {
            parse_mode: 'Markdown'
        });
    }

    handleGeneralUserMenu(chatId, userId, text);
});



bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id.toString();
    const data = callbackQuery.data;
    const user = users[userId];

    // Admin Broadcast Button Handlers
    if (userId === ADMIN_CHAT_ID) {
        if (data === 'broadcast_skip_buttons') {
            adminState.broadcast.awaitingButtons = false;

            const hasMedia = adminState.broadcast.media !== null;
            const hasText = adminState.broadcast.text && adminState.broadcast.text.trim();
            const hasButtons = adminState.broadcast.buttons.length > 0;

            if (!hasMedia && !hasText && !hasButtons) {
                resetAdminState();
                return bot.sendMessage(chatId, "❌ Broadcast flow cancelled as no content was provided.");
            }

            const opts = {
                parse_mode: 'Markdown',
                reply_markup: hasButtons ? { inline_keyboard: [adminState.broadcast.buttons] } : undefined
            };

            if (hasMedia) {
                const { type, fileId } = adminState.broadcast.media;
                if (type === 'photo') await bot.sendPhoto(chatId, fileId, { caption: adminState.broadcast.text, ...opts });
                if (type === 'video') await bot.sendVideo(chatId, fileId, { caption: adminState.broadcast.text, ...opts });
                if (type === 'animation') await bot.sendAnimation(chatId, fileId, { caption: adminState.broadcast.text, ...opts });
            } else if (hasText) {
                await bot.sendMessage(chatId, adminState.broadcast.text, opts);
            }

            bot.sendMessage(chatId, "✅ Here's a preview of your broadcast. What would you like to do?", {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📝 Edit', callback_data: 'broadcast_edit' }],
                        [{ text: '🚫 Cancel', callback_data: 'broadcast_cancel' }],
                        [{ text: '📢 Publish', callback_data: 'broadcast_publish' }]
                    ]
                }
            });
            return;
        }


        if (data === 'broadcast_edit') {
            adminState.broadcast.awaitingMedia = true;
            adminState.broadcast.awaitingText = false;
            adminState.broadcast.awaitingButtons = false;
            bot.sendMessage(chatId, "🖼 Please send an image/video/gif for the broadcast or type *SKIP* to send only text.", {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ SKIP', callback_data: 'broadcast_skip_media' }]
                    ]
                }
            });

        }

        if (data === 'broadcast_cancel') {
            adminState.broadcast.media = null;
            adminState.broadcast.text = '';
            adminState.broadcast.buttons = [];
            resetAdminState();
            bot.sendMessage(chatId, "❌ Broadcast cancelled.");
            return;
        }

        if (data === 'broadcast_publish') {
            for (const uid of Object.keys(users)) {
                const opts = {
                    parse_mode: 'Markdown',
                    reply_markup: adminState.broadcast.buttons.length ? { inline_keyboard: adminState.broadcast.buttons } : undefined
                };


                try {
                    if (adminState.broadcast.media) {
                        const { type, fileId } = adminState.broadcast.media;
                        if (type === 'photo') await bot.sendPhoto(uid, fileId, { caption: adminState.broadcast.text, ...opts });
                        if (type === 'video') await bot.sendVideo(uid, fileId, { caption: adminState.broadcast.text, ...opts });
                        if (type === 'animation') await bot.sendAnimation(uid, fileId, { caption: adminState.broadcast.text, ...opts });
                    } else {
                        await bot.sendMessage(uid, adminState.broadcast.text, opts);
                    }
                } catch (err) {
                    console.error(`Failed to send broadcast to ${uid}:`, err.message);
                }
            }

            adminState.broadcast.media = null;
            adminState.broadcast.text = '';
            adminState.broadcast.buttons = [];
            resetAdminState();
            bot.sendMessage(chatId, "📢 Broadcast sent to all users.");
            return;
        }
    }

    // Redemption Flow for Users
    const starToAmount = {
        3: 15,
        5: 25,
        10: 50,
        20: 100,
        50: 250,
        100: 500
    };

    if (data.startsWith('redeem_')) {
        const starsRequired = parseInt(data.split('_')[1]);
        const amount = starToAmount[starsRequired];

        if (!amount) {
            return bot.answerCallbackQuery(callbackQuery.id, { text: `❗ Invalid redemption option.` });
        }

        if (user.stars >= starsRequired) {
            const codesFile = path.join(__dirname, 'data', 'codes', `${starsRequired}.json`);

            if (fs.existsSync(codesFile)) {
                const codes = JSON.parse(fs.readFileSync(codesFile));

                if (codes.length === 0) {
                    return bot.answerCallbackQuery(callbackQuery.id, { text: `❗ No more ₹${amount} codes available. Please contact admin.` });
                }

                const code = codes.shift();
                fs.writeFileSync(codesFile, JSON.stringify(codes, null, 2));

                user.stars -= starsRequired;
                user.totalRedemptions = (user.totalRedemptions || 0) + 1;
                user.lastActive = new Date().toISOString();
                saveUsers();

                bot.sendPhoto(chatId, path.join(__dirname, 'assets', 'new-deposit-bonus.png'), {
                    caption: `🎉 *Congratulations!*\n\nYou redeemed *${starsRequired}⭐* for ₹${amount}!\n\nYour redemption code:\n\`${code}\`\n\n🧾 *To redeem:*\n- Login at [Raja Games](https://rajagames.in/#/login)\n- If not registered, [Register here](https://rajagames.in/#/register)\n- Enter the code in your account.\n\nEnjoy your bonus!`,
                    parse_mode: 'Markdown'
                });

                if (ADMIN_CHAT_ID) {
                    const totalStars = users[userId]?.totalStars || 0;
                    const currentStars = users[userId]?.stars || 0;
                    const referredCount = Object.values(users).filter(u => u?.referredBy?.id == userId).length;

                    bot.sendMessage(ADMIN_CHAT_ID,
                        `✅ *User Redeemed ₹${amount}:*\n\n` +
                        `👤 *${callbackQuery.from.first_name}*\n` +
                        `🆔 *${userId}*\n` +
                        `👥 *Total Referrals:* ${referredCount}\n` +
                        `🎁 *Lifetime Stars Collected:* ${totalStars}\n` +
                        `💼 *Current Star Balance:* ${currentStars}\n` +
                        `🔑 *Code:* \`${code}\``,
                        { parse_mode: 'Markdown' }
                    ).catch(err => console.error("Failed to notify admin:", err.message));
                }

                bot.answerCallbackQuery(callbackQuery.id, { text: `🎉 Redemption successful! Check your code.` });
            } else {
                bot.answerCallbackQuery(callbackQuery.id, { text: `❗ Code file for ${starsRequired}⭐ not found.` });
            }
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: `⚠ Insufficient balance!\nCurrent balance: ${user.stars} ⭐\nRequired: ${starsRequired} ⭐`, show_alert: true });
        }
        return;
    }

    if (data === 'back') {
        sendWelcomeBackMessage(chatId, users[userId]);
    }

    if (data === 'broadcast_skip_media') {
        adminState.broadcast.awaitingMedia = false;
        adminState.broadcast.awaitingText = true;

        bot.sendMessage(chatId, "📝 Now send the text content for the broadcast message.", {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ SKIP', callback_data: 'broadcast_skip_text' }]
                ]
            }
        });
    }

    if (data === 'broadcast_skip_text') {
        adminState.broadcast.awaitingText = false;
        adminState.broadcast.awaitingButtons = true;

        bot.sendMessage(chatId, "🔘 Do you want to add buttons? Send them in this format:\n`Text1|https://link1.com, Text2|https://link2.com`", {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ SKIP', callback_data: 'broadcast_skip_buttons' }]
                ]
            }
        });
    }



});

bot.onText(/\/cancel/, (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;

    if (adminState.broadcast.awaitingMedia || adminState.broadcast.awaitingText || adminState.broadcast.awaitingButtons) {
        resetBroadcastState();
        bot.sendMessage(ADMIN_CHAT_ID, "❌ Broadcast flow cancelled.");
    } else {
        bot.sendMessage(ADMIN_CHAT_ID, "ℹ️ No active broadcast flow to cancel.");
    }
});


// === Helper Functions ===

function escapeMarkdownV2(text) {
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\\-])/g, '\\$1');
}


function sendPlatformStats(chatId) {
    let totalUsers = Object.keys(users).length;
    let totalReferrals = Object.values(users).filter(u => u?.referredBy).length;
    let totalLifetimeStars = Object.values(users).reduce((sum, u) => sum + (u.totalStars || 0), 0);
    let totalCurrentStars = Object.values(users).reduce((sum, u) => sum + (u.stars || 0), 0);
    let totalRedemptions = Object.values(users).reduce((sum, u) => sum + (u.totalRedemptions || 0), 0);

    let activeUsers = Object.values(users).filter(u => {
        if (!u.lastActive) return false;
        return (new Date() - new Date(u.lastActive)) / (1000 * 60 * 60 * 24) <= 7;
    }).length;

    let refCounts = {};
    Object.values(users).forEach(u => {
        if (u?.referredBy?.id) {
            refCounts[u.referredBy.id] = (refCounts[u.referredBy.id] || 0) + 1;
        }
    });
    let topReferrerId = Object.entries(refCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    let topReferrer = topReferrerId ? (users[topReferrerId]?.name || `ID: ${topReferrerId}`) : "N/A";

    let statsMessage = `🔶 *OVERALL STATISTICS:*\n\n` +
        `👥 *Total Users:* ${totalUsers}\n\n` +
        `🔗 *Total Referrals:* ${totalReferrals}\n\n` +
        `⭐ *Total Lifetime Stars Earned:* ${totalLifetimeStars}\n\n` +
        `💼 *Total Stars Currently Held:* ${totalCurrentStars}\n\n` +
        `🎁 *Total Redemptions:* ${totalRedemptions}\n\n` +
        `🟢 *Active Users (Last 7 Days):* ${activeUsers}\n\n` +
        `👑 *Top Referrer:* ${topReferrer}\n\n`;

    bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
}




async function handleAdminBroadcastFlow(msg, chatId, userId, text) {
    if (userId !== ADMIN_CHAT_ID) return false;

    if (adminState.broadcast.awaitingMedia) {
        if (msg.photo || msg.video || msg.animation) {
            adminState.broadcast.media = msg.photo ? { type: 'photo', fileId: msg.photo[msg.photo.length - 1].file_id } :
                msg.video ? { type: 'video', fileId: msg.video.file_id } :
                    { type: 'animation', fileId: msg.animation.file_id };
            adminState.broadcast.awaitingMedia = false;
            adminState.broadcast.awaitingText = true;
            bot.sendMessage(chatId, "📝 Now send the text content for the broadcast message or click SKIP to skip text.", {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ SKIP', callback_data: 'broadcast_skip_text' }]
                    ]
                }
            });


        } else if (text.toLowerCase() === 'skip') {
            adminState.broadcast.awaitingMedia = false;
            adminState.broadcast.awaitingText = true;
            bot.sendMessage(chatId, "📝 Now send the text content for the broadcast message or click SKIP to skip text.", {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ SKIP', callback_data: 'broadcast_skip_text' }]
                    ]
                }
            });


        } else {
            bot.sendMessage(chatId, "🖼 Please send an image/video/gif for the broadcast or click SKIP to send only text.", {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ SKIP', callback_data: 'broadcast_skip_media' }]
                    ]
                }
            });

        }
        return true;
    }

    if (adminState.broadcast.awaitingText) {
        adminState.broadcast.text = text;
        adminState.broadcast.awaitingText = false;
        adminState.broadcast.awaitingButtons = true;

        bot.sendMessage(chatId, "🔘 Do you want to add buttons? Send them in this format:\n`Text1|https://link1.com, Text2|https://link2.com`", {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⬅️ SKIP', callback_data: 'broadcast_skip_buttons' }]
                ]
            }
        });
        return true;
    }

    if (adminState.broadcast.awaitingButtons) {
        adminState.broadcast.buttons = parseButtons(text);
        adminState.broadcast.awaitingButtons = false;
        showBroadcastPreview(chatId);
        return true;
    }

    return false;
}

function parseButtons(input) {
    const buttonPairs = input.split(',').map(b => b.trim()).filter(Boolean);
    const buttons = buttonPairs.map(pair => {
        const [text, url] = pair.split('|').map(p => p.trim());
        return { text, url };
    });
    return buttons.map(b => [b]);
}

function showBroadcastPreview(chatId) {
    const opts = {
        parse_mode: 'Markdown',
        reply_markup: adminState.broadcast.buttons.length ? { inline_keyboard: adminState.broadcast.buttons } : undefined
    };

    if (adminState.broadcast.media) {
        const { type, fileId } = adminState.broadcast.media;
        if (type === 'photo') bot.sendPhoto(chatId, fileId, { caption: adminState.broadcast.text, ...opts });
        if (type === 'video') bot.sendVideo(chatId, fileId, { caption: adminState.broadcast.text, ...opts });
        if (type === 'animation') bot.sendAnimation(chatId, fileId, { caption: adminState.broadcast.text, ...opts });
    } else {
        bot.sendMessage(chatId, adminState.broadcast.text, opts);
    }

    bot.sendMessage(chatId, "✅ Here's a preview of your broadcast. What would you like to do?", {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📝 Edit', callback_data: 'broadcast_edit' }],
                [{ text: '🚫 Cancel', callback_data: 'broadcast_cancel' }],
                [{ text: '📢 Publish', callback_data: 'broadcast_publish' }]
            ]
        }
    });
}

// In callback_query listener, handle actions based on data as you already have.
// Ensure other Admin Menu functions avoid calling resetAdminState() unnecessarily.

bot.onText(/\/cancel/, (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;

    if (adminState.broadcast.awaitingMedia || adminState.broadcast.awaitingText || adminState.broadcast.awaitingButtons) {
        resetBroadcastState();
        bot.sendMessage(ADMIN_CHAT_ID, "❌ Broadcast flow cancelled.");
    } else {
        bot.sendMessage(ADMIN_CHAT_ID, "ℹ️ No active broadcast flow to cancel.");
    }
});




async function handleAdminCodeFlow(msg, chatId, userId, text) {
    if (userId !== ADMIN_CHAT_ID) return false;

    // Handle amount selection for adding codes
    if (adminState.codes.awaitingAmount && userId === ADMIN_CHAT_ID) {
        const amountMap = {
            '₹15 (3⭐)': 3,
            '₹25 (5⭐)': 5,
            '₹50 (10⭐)': 10,
            '₹100 (20⭐)': 20,
            '₹250 (50⭐)': 50,
            '₹500 (100⭐)': 100
        };

        if (amountMap[text]) {
            adminState.codes.amount = amountMap[text];
            adminState.codes.awaitingAmount = false;
            adminState.codes.awaitingCodesInput = true;

            bot.sendMessage(chatId,
                `✅ You selected *₹${adminState.codes.amount}* redemption codes.\n\n` +
                `💡 Please send the codes separated by commas (e.g., CODE1,CODE2,CODE3)`,
                { parse_mode: 'Markdown' }
            );
            return true;
        } else if (text === '⬅️ BACK') {
            resetAdminState();
            sendAdminMenu(chatId);
            return true;
        } else {
            bot.sendMessage(chatId, "⚠ Please select a valid amount option or click ⬅️ BACK.");
            return true;
        }
    }

    // Handle codes input
    if (adminState.codes.awaitingCodesInput && userId === ADMIN_CHAT_ID) {
        const codes = text.split(',').map(c => c.trim()).filter(Boolean);

        if (codes.length === 0) {
            bot.sendMessage(chatId, "⚠ No valid codes detected. Please send the codes separated by commas.");
            return true;
        }

        const codesFile = path.join(__dirname, 'data', 'codes', `${adminState.codes.amount}.json`);

        let existingCodes = [];
        if (fs.existsSync(codesFile)) {
            existingCodes = JSON.parse(fs.readFileSync(codesFile));
        }

        existingCodes.push(...codes);

        fs.writeFileSync(codesFile, JSON.stringify(existingCodes, null, 2));

        bot.sendMessage(chatId, `✅ Successfully added *${codes.length}* codes to the ₹${adminState.codes.amount} file.`, { parse_mode: 'Markdown' });

        // Reset state
        adminState.codes.awaitingCodesInput = false;
        adminState.codes.amount = null;

        sendAdminMenu(chatId);
        return true;
    }


    // Handle View Existing Codes
    if (adminState.codes.awaitingViewAmount && userId === ADMIN_CHAT_ID) {
        const amountMap = {
            '₹15 (3⭐)': 3,
            '₹25 (5⭐)': 5,
            '₹50 (10⭐)': 10,
            '₹100 (20⭐)': 20,
            '₹250 (50⭐)': 50,
            '₹500 (100⭐)': 100
        };

        if (amountMap[text]) {
            const amount = amountMap[text];
            const codesFile = path.join(__dirname, 'data', 'codes', `${amount}.json`);

            if (fs.existsSync(codesFile)) {
                const codes = JSON.parse(fs.readFileSync(codesFile));
                if (codes.length === 0) {
                    bot.sendMessage(chatId, `ℹ️ No codes remaining for ₹${amount}.`);
                } else {
                    bot.sendMessage(chatId,
                        `📄 *Existing Codes for ₹${amount}:*\n\n` +
                        codes.map(c => `\`${c}\``).join('\n'),
                        { parse_mode: 'Markdown' }
                    );
                }
            } else {
                bot.sendMessage(chatId, `⚠️ No codes file found for ₹${amount}.`);
            }

            resetAdminState();
            sendAdminMenu(chatId);

            return true;
        } else if (text === '⬅️ BACK') {
            resetAdminState();
            sendAdminMenu(chatId);

            return true;
        } else {
            bot.sendMessage(chatId, "⚠ Please select a valid amount option or click ⬅️ BACK.");
            return true;
        }
    }

    // Handle Remove Codes - Amount Selection
    if (adminState.codes.awaitingRemoveAmount && userId === ADMIN_CHAT_ID) {
        const amountMap = {
            '₹15 (3⭐)': 3,
            '₹25 (5⭐)': 5,
            '₹50 (10⭐)': 10,
            '₹100 (20⭐)': 20,
            '₹250 (50⭐)': 50,
            '₹500 (100⭐)': 100
        };

        if (amountMap[text]) {
            adminState.codes.removeAmount = amountMap[text];
            adminState.codes.awaitingRemoveAmount = false;
            adminState.codes.awaitingRemoveCodes = true;

            bot.sendMessage(chatId, `✅ You selected ₹${adminState.codes.removeAmount} codes.\n\n💡 Please send the codes to remove, separated by commas.`);
            return true;
        } else if (text === '⬅️ BACK') {
            resetAdminState();
            sendAdminMenu(chatId);

            return true;
        } else {
            bot.sendMessage(chatId, "⚠ Please select a valid amount option or click ⬅️ BACK.");
            return true;
        }
    }

    // Handle Remove Codes - Code Input
    if (adminState.codes.awaitingRemoveCodes && userId === ADMIN_CHAT_ID) {
        const codesToRemove = text.split(',').map(c => c.trim()).filter(Boolean);

        if (codesToRemove.length === 0) {
            bot.sendMessage(chatId, "⚠ No valid codes detected. Please send the codes separated by commas.");
            return true;
        }

        const codesFile = path.join(__dirname, 'data', 'codes', `${adminState.codes.removeAmount}.json`);

        if (!fs.existsSync(codesFile)) {
            bot.sendMessage(chatId, `⚠️ No codes file found for ₹${adminState.codes.removeAmount}.`);
        } else {
            let existingCodes = JSON.parse(fs.readFileSync(codesFile));
            const initialCount = existingCodes.length;

            existingCodes = existingCodes.filter(code => !codesToRemove.includes(code));

            fs.writeFileSync(codesFile, JSON.stringify(existingCodes, null, 2));

            const removedCount = initialCount - existingCodes.length;
            bot.sendMessage(chatId, `✅ Removed *${removedCount}* codes from ₹${adminState.codes.removeAmount} file.`, { parse_mode: 'Markdown' });

            // Show remaining codes
            if (existingCodes.length === 0) {
                bot.sendMessage(chatId, `ℹ️ No remaining codes for ₹${adminState.codes.removeAmount}.`);
            } else {
                bot.sendMessage(chatId,
                    `📄 *Remaining Codes for ₹${adminState.codes.removeAmount}:*\n\n` +
                    existingCodes.map(c => `\`${c}\``).join('\n'),
                    { parse_mode: 'Markdown' }
                );
            }

        }

        // Reset state
        resetAdminState();
        sendAdminMenu(chatId);

        return true;
    }

    return false;
}

async function handleAdminMenuActions(chatId, userId, text) {
    if (userId !== ADMIN_CHAT_ID) return false;

      switch (text) {
        case '〽 All Statistics':
            sendPlatformStats(chatId);
            return true;

        case '➕ Add Gift Codes':
            bot.sendMessage(chatId, "💡 Please choose the amount for which you want to add codes:", {
                reply_markup: {
                    keyboard: [
                        ['₹15 (3⭐)', '₹25 (5⭐)', '₹50 (10⭐)'],
                        ['₹100 (20⭐)', '₹250 (50⭐)', '₹500 (100⭐)'],
                        ['⬅️ BACK']
                    ],
                    resize_keyboard: true
                }
            });
            adminState.codes.awaitingAmount = true;
            return true;

        case '🧾 View Avaailable Codes 🧾':
            bot.sendMessage(chatId, "💡 Please choose the amount to view codes for:", {
                reply_markup: {
                    keyboard: [
                        ['₹15 (3⭐)', '₹25 (5⭐)', '₹50 (10⭐)'],
                        ['₹100 (20⭐)', '₹250 (50⭐)', '₹500 (100⭐)'],
                        ['⬅️ BACK']
                    ],
                    resize_keyboard: true
                }
            });
            adminState.codes.awaitingViewAmount = true;
            return true;

        case '🗑 Remove Codes':
            resetAdminState();  // Safe to reset first
            adminState.codes.awaitingRemoveAmount = true;  // Set correct state
            bot.sendMessage(chatId, "💡 Please choose the amount to remove codes from:", {
                reply_markup: {
                    keyboard: [
                        ['₹15 (3⭐)', '₹25 (5⭐)', '₹50 (10⭐)'],
                        ['₹100 (20⭐)', '₹250 (50⭐)', '₹500 (100⭐)'],
                        ['⬅️ BACK']
                    ],
                    resize_keyboard: true
                }
            });
            return true;


        case '📢 Broadcast Post':
            if (adminState.broadcast.awaitingMedia || adminState.broadcast.awaitingText || adminState.broadcast.awaitingButtons) {
                bot.sendMessage(chatId, "⚠️ You already started a broadcast flow. Please complete it or type /cancel to abort.");
                return true;
            }

            resetAdminState();
            adminState.broadcast.awaitingMedia = true;
            bot.sendMessage(chatId, "🖼 Please send an image/video/gif for the broadcast or click SKIP to send only text.", {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬅️ SKIP', callback_data: 'broadcast_skip_media' }]
                    ]
                }
            });

            return true;


        case '💫 Switch as User':
            resetAdminState();
            sendWelcomeBackMessage(chatId, users[userId]);
            return true;


        case '🔍 User Lookup':
            bot.sendMessage(chatId, "🔍 Please send the User ID to view details.");
            adminState.awaitingUserId = true;
            return true;

        case '🏆 Leaderboard':
            const sortedUsers = Object.entries(users)
                .sort(([, a], [, b]) => (b.totalStars || 0) - (a.totalStars || 0))
                .slice(0, 10);

            if (sortedUsers.length === 0) {
                bot.sendMessage(chatId, "⚠ No users found for the leaderboard.");
                return true;
            }

            let leaderboardText = `🏆 *Top 10 Users by Total Stars:*\n\n`;

            sortedUsers.forEach(([uid, user], index) => {
                const safeName = escapeMarkdownV2(user.name || "Unknown");
                const safeUsername = user.username ? `@${escapeMarkdownV2(user.username)}` : "No username";
                const safeStars = user.totalStars || 0;

                leaderboardText += `${index + 1}\\. *${uid}* :\n 👤 ${safeName} \\| ${safeUsername} \\| ${safeStars} ⭐\n\n`;
            });

            bot.sendMessage(chatId, leaderboardText, { parse_mode: 'MarkdownV2' });

            return true;

        case '💠 Admin Panel 💠':
            resetAdminState();
            sendAdminMenu(chatId);
            return true;

    }

    return false;
}

async function handleAdminUserLookup(chatId, userId, text) {
    if (!adminState.awaitingUserId || userId !== ADMIN_CHAT_ID) return false;

    const targetId = text.trim();
    const targetUser = users[targetId];

    if (targetUser) {
        const referrals = Object.values(users).filter(u => u?.referredBy?.id == targetId).length;
        bot.sendMessage(chatId,
            `👤 *User Details:*\n\n` +
            `🆔 *User ID:* ${targetId}\n` +
            `👨‍💼 *Name:* ${targetUser.name || 'Unknown'}\n` +
            `🔗 *Username:* ${targetUser.username ? '@' + targetUser.username : 'Not Set'}\n` +
            `⭐️ *Total Stars:* ${targetUser.totalStars || 0}\n` +
            `💼 *Current Stars:* ${targetUser.stars || 0}\n` +
            `👥 *Referrals:* ${referrals}\n` +
            `📅 *Join Date:* ${targetUser.joinDate ? new Date(targetUser.joinDate).toLocaleString() : 'Unknown'}\n` +
            `🕓 *Last Active:* ${targetUser.lastActive ? new Date(targetUser.lastActive).toLocaleString() : 'Unknown'}\n` +
            `🎯 *Total Redemptions:* ${targetUser.totalRedemptions || 0}`,
            { parse_mode: 'Markdown' }
        );
    } else {
        bot.sendMessage(chatId, `⚠️ No user found with ID: ${targetId}`);
    }

    resetAdminState();
    return true;
}

function handleGeneralUserMenu(chatId, userId, text) {
    switch (text) {
        case '⭐ Earn Stars':
            sendShareMenu(chatId);
            break;

        case '⭐ Get My Invite Link 📎':
            bot.sendPhoto(chatId, path.join(__dirname, 'assets', 'new-deposit-bonus.png'), {
                caption: `✅ *Exclusive Channel Invitation Link:*\nhttps://t.me/${BOT_USERNAME}?start=${userId}\n\n🌟 Share your unique referral link in various groups and earn stars!`,
                parse_mode: 'Markdown'
            });
            break;

        case '⭐ My Star Balance 💰':
            if (!users[userId]) {
                users[userId] = { stars: 0, totalStars: 0 };
                saveUsers();
            }
            const user = users[userId];
            const referrals = getReferralCount(userId);
            bot.sendMessage(chatId,
                `👤 *Account Summary*\n\n` +
                `👨‍💼 *Username:* ${users[userId]?.name || 'RAJA GAMES USER'}\n` +
                `🆔 *User ID:* ${userId}\n\n` +
                `💼 *Balance Information*\n━━━━━━━━━━━━━━━━━━━━━━\n` +
                `⭐ *Total Stars Collected:* ${user.totalStars || 0} ⭐\n` +
                `🎁 *Current Star Balance:* ${user.stars} ⭐\n` +
                `👥 *Referrals:* ${referrals}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🎯 Accumulate *10 Stars* to redeem ₹50 bonus!\n✨ Keep sharing to earn more stars and claim exciting rewards!`,
                { parse_mode: 'Markdown' }
            );
            break;

        case '⭐ Redeem My Stars to Rewards 💸':
            bot.sendPhoto(chatId, path.join(__dirname, 'assets', 'new-deposit-bonus.png'), {
                caption: `🏛 *How to Redeem Free Bonus*\n\n🧾 Click on the star points you want to redeem, and the system will automatically send you a free redemption code. You can log in to [Raja Games](https://rajagames.in/#/login) to redeem and receive it.\n\n✅ Not yet a platform member? 👉 [Click here](https://rajagames.in/#/register)`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎁 3 star points = ₹15 (3⭐)', callback_data: 'redeem_3' }],
                        [{ text: '🎁 5 star points = ₹25 (5⭐)', callback_data: 'redeem_5' }],
                        [{ text: '🎁 10 star points = ₹50 (10⭐)', callback_data: 'redeem_10' }],
                        [{ text: '🎁 20 star points = ₹100 (20⭐)', callback_data: 'redeem_20' }],
                        [{ text: '🎁 50 star points = ₹250 (50⭐)', callback_data: 'redeem_50' }],
                        [{ text: '🎁 100 star points = ₹500 (100⭐)', callback_data: 'redeem_100' }],
                        [{ text: '⬅️ BACK', callback_data: 'back' }]
                    ]
                }
            });
            break;

        case '❤️ Post & Share ₹28-288':
            bot.sendPhoto(chatId, path.join(__dirname, 'assets', 'new-deposit-bonus.png'), {
                caption: `👋 Welcome to join the *Post and Share* event!\n\n⚡ You can claim ₹28 to ₹288 free rewards here anytime every day.\n⭐ If you are participating in the event for the first time:\n\n📝 Click *How to share* to view posting examples and event requirements.\n\nRecently, we have increased the agent commission rate, increased VIP betting rebates, and increased welfare activities.\n\nPromoting the *Raja Games* platform will help you achieve financial freedom successfully.`,
                parse_mode: 'Markdown',
                reply_markup: {
                    keyboard: [
                        ['🎯 How to share', '🟧 Get pictures and information'],
                        ['🔻 Get exclusive sharing links', '💰 Verify and claim your bonus'],
                        ['⬅️ BACK']
                    ],
                    resize_keyboard: true
                }
            });
            return;

        case '🎯 How to share':
            bot.sendPhoto(chatId, path.join(__dirname, 'assets', 'new-deposit-bonus.png'), {
                caption: `Step 1: Click the 🟧 *Get pictures and information* button to get the promotional material.\n\nStep 2: Get your exclusive invitation link from *Raja Games* and insert it at the end of the promotional text.\n\nStep 3: Post the content on platforms like Facebook, Instagram, Whatsapp, etc. Make sure your post is public.\n\n💡 After at least 2 hours, copy your post link and submit it for verification to claim your reward.`,
                parse_mode: 'Markdown'
            });
            return;

        case '🟧 Get pictures and information':
            bot.sendPhoto(chatId, path.join(__dirname, 'assets', 'new-deposit-bonus.png'), {
                caption: `📥 Please save the image above and copy the promotional text below. 👇\n\n*Raja Games - India's most trusted gaming platform!*\n🎮 Play popular games like Aviator, JILI, Evolution, etc.\n📲 Join our official channel: https://t.me/rajagameshelpbot\n💰 Sign up now to get ₹200 free bonus and start your gaming journey easily!\n🛡️ Safe & reliable, easy deposit & withdrawal, worry-free funds!`,
                parse_mode: 'Markdown'
            });
            return;

        case '🔻 Get exclusive sharing links':
            bot.sendPhoto(chatId, path.join(__dirname, 'assets', 'new-deposit-bonus.png'), {
                caption: `🔗 *How to get your exclusive invitation link:*\n\n1. Open Raja Games app, click the "Earn" pop-up window.\n2. Click "Invite your friends" and copy your exclusive link.\n\n⚠️ Remember to add your exclusive contact at the end of the promotional text.`,
                parse_mode: 'Markdown'
            });
            return;

        case '💰 Verify and claim your bonus':
            bot.sendMessage(chatId, `✅ Please click the button below to verify your post and claim your bonus:`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '✅ Click here', url: 'https://t.me/RAJAGAMESERVICE_BOT' }]
                    ]
                }
            });
            return;

        case '📚 Deposit Guide':
            bot.sendPhoto(chatId, path.join(__dirname, 'assets', 'new-deposit-bonus.png'), { caption: '📚 Deposit Guide' });
            break;

        case '🧩 Install Raja Game App':
            bot.sendDocument(chatId, path.join(__dirname, 'assets', 'RajaGamesAppV2.2_2025.04.24.apk'), { caption: '🏛 Download the game APK' });
            break;

        case '💬 24-hour customer service':
            bot.sendPhoto(chatId, path.join(__dirname, 'assets', 'new-deposit-bonus.png'), { caption: '💬 Our customer service is available 24/7!' });
            break;

        case '⬅️ BACK':
            resetAdminState();
            sendWelcomeBackMessage(chatId, users[userId]);
            return;
    }

}


async function sendShareMenu(chatId) {
    const keyboard = {
        keyboard: [
            ['⭐ Get My Invite Link 📎'],
            ['⭐ My Star Balance 💰'],
            ['⭐ Redeem My Stars to Rewards 💸'],
            ['⬅️ BACK']
        ],
        resize_keyboard: true
    };

    bot.sendPhoto(chatId, path.join(__dirname, 'assets', 'new-deposit-bonus.png'), {
        caption: '🌟 Share the channel, earn star credit! Collect and redeem for ₹50 daily rewards!',
    }).then(() => {
        bot.sendMessage(chatId, 'Choose an option:', { reply_markup: keyboard });
    });

}

console.log("🤖 RAJA GAMES HELP BOT with Admin features is running...");


const PORT = process.env.PORT || 3000;

app.post(`/bot/${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Webhook server running on port ${PORT}`);
});
